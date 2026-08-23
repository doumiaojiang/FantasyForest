/**
 * systems/battle.js — 战斗系统（多目标版）
 *
 * 支持多个敌人目标（如哥布林群、魔女召唤物）。
 * 战斗状态存于 GameState._battle：
 * {
 *   enemyId,                 // 主敌（战利品来源）
 *   targets: [               // 所有可攻击目标
 *     { id, name, hp, maxHp, type, dmgPerTurn? }
 *   ],
 *   turn, extraAttacks, reflectTurns, orbBoost, blocked,
 * }
 */

window.BattleSystem = (function () {
  /** 开始战斗 */
  function start (enemyId, opts = {}) {
    const state = State.get()
    const enemy = DATA.monster(enemyId)
    if (!enemy) { console.error('未知怪物:', enemyId); return }
    const insertionBlocks = typeof RestraintSystem !== 'undefined' ? RestraintSystem.insertionBlocks() : { anal: 0, vagina: 0 }

    state._battle = {
      enemyId,
      targets: [],
      turn: 1,
      extraAttacks: opts.extraAttacks || 1,
      extraAttacksUsed: 0,   // 本回合已用攻击次数（每回合重置）
      reflectTurns: 0,
      orbBoost: false,
      blocked: (insertionBlocks.anal || 0) + (insertionBlocks.vagina || 0),
      insertionBlocks,      // DD 插入装备按身体部位记录的本场剩余格挡
      bossForcedUnlockUsed: false,
      defending: false,
      goblinInitialCount: null,
    }
    buildTargets(enemy, state._battle)
    state.phase = 'battle'

    if (state._battle.blocked > 0) {
      const parts = []
      if (insertionBlocks.anal > 0) parts.push(`菊穴 ${insertionBlocks.anal}`)
      if (insertionBlocks.vagina > 0) parts.push(`小穴 ${insertionBlocks.vagina}`)
      EventBus.emit('ui:log', { text: `⚡ 当前插入装备防护充能：${parts.join(' · ')}。`, type: 'good' })
    }

    // 陷阱效果：HP 翻倍
    if (state._nextEnemyHpDouble) {
      state._battle.targets.forEach(t => { t.hp *= 2; t.maxHp *= 2 })
      state._nextEnemyHpDouble = false
      EventBus.emit('ui:log', { text: '💊 怪物喝掉了你的治疗药水，HP 翻倍！', type: 'danger' })
    }

    // 陷阱效果：双敌（每回合 2 次攻击）
    if (state._nextBattleExtraAttacks) {
      state._battle.extraAttacks = state._nextBattleExtraAttacks
      state._nextBattleExtraAttacks = 0
      EventBus.emit('ui:log', { text: '⚔️ 两只敌人同时攻击，你每回合有 2 次攻击机会！', type: 'good' })
    }

    EventBus.emit('state:changed', state)
    EventBus.emit('battle:start', { enemy, battle: state._battle })
  }

  /** 根据怪物体构建目标列表 */
  function buildTargets (enemy, battle) {
    // 哥布林：群体作战，每只独立 5 HP（数量由掷骰决定，按 ABCD 命名）
    if (enemy.id === 'goblins') {
      const count = rollGoblinCount(enemy)
      const letters = ['A', 'B', 'C', 'D', 'E']
      for (let i = 0; i < count; i++) {
        const label = letters[i] || (i + 1)
        battle.targets.push({ id: 'goblin-' + i, name: '哥布林 ' + label, hp: 5, maxHp: 5, type: 'goblin', dmgPerTurn: 0 })
      }
      battle.goblinInitialCount = count  // 供战利品用
      return
    }
    // 普通怪：单目标
    battle.targets = [{ id: 'main', name: enemy.name, hp: enemy.maxHp, maxHp: enemy.maxHp, type: 'main', dmgPerTurn: 0 }]
  }

  /** 掷 Z 决定哥布林数量（含骰子动画提示） */
  function rollGoblinCount (enemy) {
    const z = Dice.rollZ()
    const props = enemy.props || {}
    const map = props.countRolls || [3, 3, 4, 4, 5, 5]
    const count = map[Math.min(z - 1, map.length - 1)] || 3
    // 显示骰子动画 + 数量提示
    if (typeof Dialog !== 'undefined' && Dialog.showDice) {
      Dialog.showDice(z, 'Z')
    }
    EventBus.emit('ui:log', { text: `🎲 掷 Z=${z} → 👺 ${count} 只哥布林扑了上来！`, type: 'danger' })
    return count
  }

  /** 主目标（第一只） */
  function mainTarget () {
    const b = State.get()._battle
    return b ? b.targets[0] : null
  }

  /** 所有可攻击目标 */
  function getTargets () {
    const b = State.get()._battle
    return b ? b.targets : []
  }

  /** 玩家攻击指定目标（掷 Y） */
  function playerAttack (targetId, roll) {
    const state = State.get()
    const battle = state._battle
    if (!battle) return null

    if (roll === undefined) roll = Dice.rollAttack()
    const result = AttackResolver.resolvePlayer(roll, battle)
    let bossDefeated = false

    // 命中目标
    if (!result.hitSelf && result.dmg > 0) {
      const target = battle.targets.find(t => t.id === targetId) || battle.targets[0]
      if (target) {
        target.hp -= result.dmg
        result.target = { id: target.id, name: target.name }
        // 目标死亡
        if (target.hp <= 0) {
          bossDefeated = battle.enemyId === 'spirit_of_forest' && target.id === 'main'
          handleTargetDeath(battle, target)
        }
      }
    }

    // 佣兵攻击：玩家命中后，佣兵补一刀（玩家 miss 时她也 miss）；发情时无法专心攻击
    const mercenary = state._mercenary
    if (mercenary && !mercenary.dead && !result.hitSelf && !result.miss && battle.targets.length > 0 && state.hp > 0) {
      if (mercenary.lust >= 100) {
        result.mercenary = { name: mercenary.name, icon: mercenary.icon, dmg: 0, target: '发情中', lustBlocked: true }
        EventBus.emit('ui:log', { text: `💢 ${mercenary.icon} ${mercenary.name} 欲火焚身，夹着腿扭来扭去，没法专心攻击！快去服务她。`, type: 'danger' })
      } else {
        const mTarget = battle.targets[0]
        mTarget.hp -= mercenary.dmg
        result.mercenary = { name: mercenary.name, icon: mercenary.icon, dmg: mercenary.dmg, target: mTarget.name, killed: false }
        EventBus.emit('ui:log', { text: `💀 ${mercenary.icon} ${mercenary.name} 挥刀砍向 ${mTarget.name}，造成 ${mercenary.dmg} 伤害！`, type: 'good' })
        if (mTarget.hp <= 0) {
          result.mercenary.killed = true
          bossDefeated = battle.enemyId === 'spirit_of_forest' && mTarget.id === 'main'
          handleTargetDeath(battle, mTarget)
        }
      }
      // 战斗后性欲上升（按难度：普通+5 / 困难+10 / 残酷+15）
      const lustGain = { normal: 5, hard: 10, brutal: 15 }[state.difficulty] || 5
      mercenary.lust = Math.min(100, (mercenary.lust || 0) + lustGain)
      EventBus.emit('state:changed', state)
    }

    // 魅魔生命链接
    applySelfDamageOnHit(state, result)
    EventBus.emit('battle:attack', { roll, result })
    // 攻击伤害已写入战斗目标，立即通知 HUD 刷新血条与数值
    EventBus.emit('state:changed', state)

    // 玩家死亡检查（魅魔自伤/混乱自伤可能致死），优先于胜利判定
    if (state.hp <= 0) {
      end(false)
      return result
    }

    // 森林之灵本体倒下即获胜，小兵无需全部击杀。
    if (bossDefeated) {
      end(true)
      return result
    }

    // 胜利判定
    if (battle.targets.length === 0) {
      end(true)
    }
    return result
  }

  /** 目标死亡处理 */
  function handleTargetDeath (battle, target) {
    EventBus.emit('ui:log', { text: `💀 ${target.name} 被击杀了！`, type: 'good' })
    battle.targets = battle.targets.filter(t => t.id !== target.id)
    checkPackFlee(battle)
  }

  /** 移除死亡目标（供外部调用） */
  function removeTarget (id) {
    const battle = State.get()._battle
    if (!battle) return
    battle.targets = battle.targets.filter(t => t.id !== id)
    if (battle.targets.length === 0) end(true)
    else checkPackFlee(battle)
  }

  /** 群居怪：只剩 1 只时逃跑（结束战斗） */
  function checkPackFlee (battle) {
    const enemy = battle ? DATA.monster(battle.enemyId) : null
    if (!enemy || !enemy.props || !enemy.props.packHunt) return
    const aliveGoblins = battle.targets.filter(t => t.type === 'goblin').length
    if (aliveGoblins === 1) {
      EventBus.emit('ui:log', { text: '🏃 最后一只哥布林见势不妙，逃跑了！', type: 'good' })
      end(true)
    }
  }

  /** 防御：本回合减少敌人伤害 */
  function defend () {
    const state = State.get()
    const battle = state._battle
    if (!battle) return false
    battle.defending = true
    EventBus.emit('ui:log', { text: '🛡️ 你摆出防御姿态，下回合伤害减半。', type: 'good' })
    EventBus.emit('state:changed', state)
    return true
  }

  /** 逃跑：根据难度概率成功（force=true 时必成功，供投降使用） */
  function flee (force) {
    const state = State.get()
    const battle = state._battle
    if (!battle) return { ok: false }

    const chance = CONFIG.battle.fleeChance[state.difficulty] || 0.5
    const roll = Math.random()
    const success = force ? true : (roll < chance)

    EventBus.emit('ui:log', { text: force ? '🏳️ 你选择投降……' : `🏃 尝试逃跑... (概率 ${Math.round(chance*100)}%) 掷骰: ${roll.toFixed(2)} ${success ? '✅ 成功！' : '❌ 失败！'}`, type: success ? 'good' : 'danger' })

    if (success) {
      // 结束战斗
      const prev = battle.prevPos   // 存档里的来源格（读档后仍可用）
      state._battle = null
      state.phase = 'idle'
      EventBus.emit('state:changed', state)
      EventBus.emit('battle:end', { victory: true, loot: { gold: 0, drops: [] }, fled: true, prevPos: prev, surrendered: force })
    }
    return { ok: success }
  }

  /** 魅魔自伤效果 */
  function applySelfDamageOnHit (state, result) {
    const enemy = state._battle ? DATA.monster(state._battle.enemyId) : null
    if (!enemy || !enemy.props || !enemy.props.selfDamageOnHit) return
    // 每次攻击都自伤（含未命中）
    const selfDmg = result.crit ? 2 : 1
    state.hp -= selfDmg
    result.selfDamage = selfDmg
    EventBus.emit('state:changed', state)
  }

  /** 战斗结束 */
  function end (victory) {
    const state = State.get()
    const battle = state._battle
    if (!battle) return

    if (victory) {
      // 魅魔：掷一次 Z 决定临死反击还是掉落（共用同一骰子结果）
      let lootRoll = null
      if (battle.enemyId === 'succubus' && !battle.succubusDeathRattleDone) {
        lootRoll = Dice.rollZ()
        if (lootRoll === 4) {
          battle.succubusDeathRattleDone = true
          // 魅魔已从目标列表移除，需要重新添加她才能继续战斗
          if (!battle.targets || battle.targets.length === 0) {
            const baseHp = (DATA.monster('succubus') && DATA.monster('succubus').maxHp) || 8
            battle.targets = [{ id: 'main', name: '魅魔', hp: baseHp, maxHp: baseHp, type: 'main', dmgPerTurn: 0 }]
          }
          const target = battle.targets[0]
          const heal = Math.ceil(target.maxHp * 0.5)
          target.hp = Math.min(heal, 10)
          const hpLoss = Math.ceil(state.hp * 0.25)
          state.hp -= hpLoss
          battle.enraged = true
          EventBus.emit('ui:log', { text: `💀 魅魔临死反击！恢复 ${heal} HP，你损失 ${hpLoss} HP，她进入狂暴状态！`, type: 'danger' })
          EventBus.emit('state:changed', state)
          // 临死反击扣血可能致死，先判定玩家死亡
          if (state.hp <= 0) {
            end(false)
            return
          }
          return  // 战斗继续！
        }
      }

      state.defeated.push(battle.enemyId)
      const loot = LootSystem.collect(battle.enemyId, lootRoll)
      // 特殊掉落事件持久化（防刷新跳过：断触手/狼人遗愿/魔女召唤）
      if (loot.tentacleEmbedded || loot.werewolfFinal || loot.rerollEncounter) {
        state._pendingLootEvent = { type: null }
        if (loot.tentacleEmbedded) state._pendingLootEvent.type = 'tentacle_embedded'
        else if (loot.werewolfFinal) state._pendingLootEvent.type = 'werewolf_final'
        else if (loot.rerollEncounter) state._pendingLootEvent.type = 'reroll_encounter'
      } else {
        state._pendingLootEvent = null
      }
      // 树枝：每击败一个敌人消耗 1 根（无武器时）
      if (!state.inventory.weapon && (state.inventory.consumables['twig'] || 0) > 0) {
        state.inventory.consumables['twig']--
        const left = state.inventory.consumables['twig']
        if (left > 0) {
          EventBus.emit('ui:log', { text: `🌿 树枝还能再打 ${left} 个敌人。`, type: 'dim' })
        } else {
          EventBus.emit('ui:log', { text: '🌿 树枝断裂了，恢复赤手空拳。', type: 'dim' })
        }
      }
      state._battle = null
      state.phase = 'idle'
      EventBus.emit('state:changed', state)
      EventBus.emit('battle:end', { victory: true, loot, enemyId: battle.enemyId })
    } else {
      // 战败：树枝断裂
      if (!state.inventory.weapon && (state.inventory.consumables['twig'] || 0) > 0) {
        state.inventory.consumables['twig'] = 0
        EventBus.emit('ui:log', { text: '💔 战败中，树枝断裂了。', type: 'danger' })
      }
      // 你死了，佣兵也跟你一起倒下（死亡，可到商店花 50G 复活）
      if (state._mercenary && !state._mercenary.dead) {
        state._mercenary.dead = true
        EventBus.emit('ui:log', { text: `💔 ${state._mercenary.icon} ${state._mercenary.name} 替你挡下最后一击，倒在你身边……她没能活下来。可到商店花 50G 复活她。`, type: 'danger' })
      }
      state.phase = 'gameover'
      EventBus.emit('state:changed', state)
      EventBus.emit('battle:end', { victory: false, enemyId: battle.enemyId })
      EventBus.emit('game:gameover', {})
    }
  }

  return { start, playerAttack, getTargets, mainTarget, removeTarget, end, defend, flee }
})()

/* ---------- 掷骰工具 ---------- */
window.Dice = {
  d6 () { return Math.floor(Math.random() * 6) + 1 },
  rollMove () {
    const cfg = CONFIG.difficulty[State.get().difficulty]
    const y = this.d6()
    if (cfg.moveFn === 'Y') return y
    if (cfg.moveFn === 'Y_DIV2_CEIL') return Math.ceil(y / 2)
    if (cfg.moveFn === 'FIXED_1') return 1
    return y
  },
  rollAttack () { return this.d6() },
  rollEnemy () { return this.d6() },
  rollZ () { return this.d6() },
}

/* ---------- 攻击结算（玩家） ---------- */
window.AttackResolver = {
  resolvePlayer (roll, battle) {
    const state = State.get()
    const weapon = state.inventory.weapon
    const twigCount = state.inventory.consumables['twig'] || 0
    let baseDmg
    if (weapon) {
      const w = ItemLib.weapon(weapon)
      baseDmg = (w && w.effect && typeof w.effect.damage === 'number') ? w.effect.damage : CONFIG.player.baseDamage
    } else if (twigCount > 0) {
      baseDmg = 2   // 坚韧树枝作为武器
    } else {
      baseDmg = CONFIG.player.baseDamage
    }

    const cfg = CONFIG.battle
    let mult = 0
    if (roll <= cfg.missThreshold[state.difficulty]) mult = 0
    else if (roll >= cfg.critThreshold[state.difficulty]) mult = cfg.critMult
    else mult = cfg.normalMult

    let dmg = Math.round(baseDmg * mult)

    // 手铐/反绑束臂器：武器伤害降低
    if (mult > 0 && typeof RestraintSystem !== 'undefined') {
      if (RestraintSystem.hasArmbinder()) dmg = Math.max(1, Math.round(dmg * 0.4))
      else if (RestraintSystem.hasHandcuffs()) dmg = Math.max(1, Math.round(dmg * 0.7))
    }

    // 力量宝珠：只在命中时附加武器基础伤害（未命中不造成伤害）
    if (battle.orbBoost && mult > 0) { dmg += baseDmg; battle.orbBoost = false }
    if (battle.orbBoost && mult === 0) battle.orbBoost = false   // 未命中：宝珠消耗但不生效

    const accs = state.inventory.accessories || []
    if (accs.includes('sacrificial_necklace')) dmg *= 2

    let mod = { roll, dmg }
    state.statuses.slice().forEach(s => {
      const def = STATUS_EFFECTS[s.id]
      if (def && def.onAttack) mod = def.onAttack(state, s, mod)
    })

    return { roll, dmg: mod.dmg, crit: mult === cfg.critMult, miss: mult === 0, hitSelf: mod.hitSelf || false, stunned: mod.stunned || false }
  },
}
