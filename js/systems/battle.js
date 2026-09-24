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
  const CARAVAN_BINDING_SEQUENCE = [
    { slot: 'neck', id: 'slave_collar', label: '奴隶项圈', icon: '🐕' },
    { slot: 'arms', id: 'handcuffs', label: '手铐', icon: '⛓️' },
    { slot: 'mouth', id: 'leather_gag', label: '球形口塞', icon: '🤐' },
    { slot: 'anal', id: 'butt_plug', label: '小肛塞', icon: '🍑' },
  ]

  /** 开始战斗 */
  function start (enemyId, opts = {}) {
    const state = State.get()
    const enemy = DATA.monster(enemyId)
    if (!enemy) { console.error('未知怪物:', enemyId); return }
    const insertionBlocks = typeof RestraintSystem !== 'undefined' ? RestraintSystem.insertionBlocks() : { anal: 0, vagina: 0 }

    state._battle = {
      enemyId,
      story: opts.story || null,
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
      caravanBindings: [],
      caravanFourfoldCapture: false,
      banditAmbushPending: !!(enemy.props && enemy.props.banditCrew && enemy.props.banditCrew.length),
      banditCoverUsed: [],
      banditClothesTaken: false,
      banditGoldStolen: 0,
      enemyState: EnemyAbilitySystem.createState(enemy, opts),
    }
    buildTargets(enemy, state._battle)
    if (opts.banditNoCover && enemyId === 'p_bandit_leader') {
      state._battle.banditCoverUsed = state._battle.targets.filter(target => target.type === 'bandit').map(target => target.id)
    }
    if (Number.isFinite(opts.hpMult) && opts.hpMult > 0 && opts.hpMult !== 1) {
      state._battle.targets.forEach(target => {
        target.hp = Math.max(1, Math.ceil(target.hp * opts.hpMult))
        target.maxHp = target.hp
      })
    }
    EnemyAbilitySystem.applyEliteHealth(state._battle)
    state.phase = 'battle'

    const elite = EnemyAbilitySystem.eliteDef(state._battle)
    if (elite) {
      const eliteText = enemy.props?.storyEncounter
        ? `${elite.icon} 你主动把看守逼入${elite.name}状态：生命与攻击压力提高，但不会得到额外战利品。`
        : `${elite.icon} 遭遇${elite.name}：生命 +50%、金币 +50%，击败后必定掉落异变结晶。`
      EventBus.emit('ui:log', { text: eliteText, type: 'danger' })
    }

    if (state._battle.blocked > 0) {
      const parts = []
      if (insertionBlocks.anal > 0) parts.push(`菊穴 ${insertionBlocks.anal}`)
      if (insertionBlocks.vagina > 0) parts.push(`小穴 ${insertionBlocks.vagina}`)
      EventBus.emit('ui:log', { text: `⚡ 当前插入装备防护充能：${parts.join(' · ')}。`, type: 'good' })
    }
    if (typeof RestraintSystem !== 'undefined' && RestraintSystem.vibrationInfo) {
      const vibration = RestraintSystem.vibrationInfo('vagina')
      if (vibration && vibration.mode !== 'off') {
        EventBus.emit('ui:log', { text: `${vibration.mode === 'high' ? '⚡' : '〰️'} ${vibration.def.name}保持${RestraintSystem.VIBRATION_MODES[vibration.mode].label}：攻击分心 ${Math.round(vibration.distractionChance * 100)}%，逃跑率 -${Math.round(vibration.escapePenalty * 100)}%。`, type: 'danger' })
      }
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
    // 哥布林：群体作战，数量与单体生命按难度决定（按 ABCD 命名）
    if (enemy.id === 'goblins') {
      const count = rollGoblinCount(enemy)
      const unitHp = goblinUnitHp(enemy)
      const letters = ['A', 'B', 'C', 'D', 'E']
      for (let i = 0; i < count; i++) {
        const label = letters[i] || (i + 1)
        battle.targets.push({ id: 'goblin-' + i, name: `${EnemyAbilitySystem.displayName(enemy, battle)} ${label}`, hp: unitHp, maxHp: unitHp, type: 'goblin', dmgPerTurn: 0 })
      }
      battle.goblinInitialCount = count  // 供战利品用
      return
    }
    // 强盗据点：头目与两名脆弱喽啰同场。集中击倒头目即可瓦解整支匪帮。
    if (enemy.props && Array.isArray(enemy.props.banditCrew)) {
      battle.targets.push({ id: 'main', name: EnemyAbilitySystem.displayName(enemy, battle), hp: enemy.maxHp, maxHp: enemy.maxHp, type: 'main', dmgPerTurn: 0 })
      enemy.props.banditCrew.forEach(member => {
        const hp = Math.max(1, Math.floor(member.hp || 3))
        battle.targets.push({ id: member.id, name: member.name, hp, maxHp: hp, type: 'bandit', dmgPerTurn: 0 })
      })
      return
    }
    // 普通怪：单目标
    battle.targets = [{ id: 'main', name: EnemyAbilitySystem.displayName(enemy, battle), hp: enemy.maxHp, maxHp: enemy.maxHp, type: 'main', dmgPerTurn: 0 }]
  }

  /** 掷 Z 决定哥布林数量（含骰子动画提示） */
  function rollGoblinCount (enemy) {
    const z = Dice.rollZ()
    const props = enemy.props || {}
    const difficulty = State.get().difficulty || 'normal'
    const map = (props.countRollsByDifficulty && props.countRollsByDifficulty[difficulty]) || props.countRolls || [3, 3, 4, 4, 5, 5]
    const count = map[Math.min(z - 1, map.length - 1)] || 3
    // 显示骰子动画 + 数量提示
    if (typeof Dialog !== 'undefined' && Dialog.showDice) {
      Dialog.showDice(z, 'Z')
    }
    EventBus.emit('ui:log', { text: `🎲 掷 Z=${z} → 👺 ${count} 只哥布林扑了上来！`, type: 'danger' })
    return count
  }

  /** 哥布林单体生命按难度调整；普通难度允许徒手稳定破局。 */
  function goblinUnitHp (enemy) {
    const props = enemy.props || {}
    const difficulty = State.get().difficulty || 'normal'
    return (props.hpByDifficulty && props.hpByDifficulty[difficulty]) || enemy.maxHp || 5
  }

  /** 主目标（第一只） */
  function mainTarget () {
    const b = State.get()._battle
    return b ? b.targets[0] : null
  }

  /** 派克车队看守：普通战持续十回合后自动转入狂暴版，并保留此前受到的伤害。 */
  function maybeEnrageCaravan () {
    const state = State.get()
    const battle = state._battle
    if (!battle || battle.enemyId !== 'p_caravan_guard' || battle.caravanEnraged) return false
    if (battle.story === 'commission-provoked') return false

    const enemy = DATA.monster(battle.enemyId)
    const threshold = Number(enemy?.props?.autoBerserkTurn || 0)
    const elapsedTurns = Number(battle.enemyState?.enemyTurns || 0)
    if (threshold <= 0 || elapsedTurns < threshold) return false

    const target = battle.targets.find(entry => entry.id === 'main') || battle.targets[0]
    if (!target || target.hp <= 0) return false

    const damageTaken = Math.max(0, target.maxHp - target.hp)
    const provokedMaxHp = Math.max(target.maxHp, Number(enemy?.props?.provokedMaxHp || target.maxHp))
    target.maxHp = provokedMaxHp
    target.hp = Math.max(1, provokedMaxHp - damageTaken)
    target.name = `狂暴${enemy.name}`

    battle.caravanEnraged = true
    battle.enemyState.elite = 'berserk'
    battle.enemyState.charging = false
    battle.enemyState.chargeStrike = false
    battle.enemyState.chargeDamageTaken = 0

    EventBus.emit('ui:log', {
      text: `⚡ 十回合仍未分出胜负。看守吹响车队铜哨，同伙从桥后赶来；已造成的 ${damageTaken} 点伤害保留，狂暴看守现为 ${target.hp}/${target.maxHp} HP。`,
      type: 'danger',
    })
    EventBus.emit('state:changed', state)
    State.save()
    return true
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
    const enemy = DATA.monster(battle.enemyId)

    if (roll === undefined) roll = Dice.rollAttack()
    const result = AttackResolver.resolvePlayer(roll, battle)
    if (typeof RestraintSystem !== 'undefined' && RestraintSystem.vibrationDistraction && !result.hitSelf && !result.stunned && !result.miss) {
      const distraction = RestraintSystem.vibrationDistraction()
      if (distraction.triggered) {
        result.dmg = 0
        result.crit = false
        result.miss = true
        result.vibrationDistracted = true
        result.vibrationMode = distraction.mode
        result.vibrationName = distraction.name
      }
    }
    let bossDefeated = false
    let banditLeaderDefeated = false

    // 命中目标
    if (!result.hitSelf && result.dmg > 0) {
      let target = battle.targets.find(t => t.id === targetId) || battle.targets[0]
      // 桥洞匪帮各替头目挡一次命中；之后仍允许直攻头目，避免强制清场拖长序章。
      if (battle.enemyId === 'p_bandit_leader' && target && target.id === 'main') {
        if (!Array.isArray(battle.banditCoverUsed)) battle.banditCoverUsed = []
        const cover = battle.targets.find(candidate => candidate.type === 'bandit' && !battle.banditCoverUsed.includes(candidate.id))
        if (cover) {
          battle.banditCoverUsed.push(cover.id)
          target = cover
          result.banditIntercepted = { id: cover.id, name: cover.name }
          EventBus.emit('ui:log', { text: `🛡️ ${cover.name}扑到头目前面，替他挡下了这次命中；他不会再替头目挡第二次。`, type: 'warning' })
        }
      }
      if (target) {
        EnemyAbilitySystem.modifyPlayerAttack(enemy, battle, result, target)
        target.hp -= result.dmg
        result.target = { id: target.id, name: target.name }
        EnemyAbilitySystem.afterPlayerHit(enemy, battle, target, result)
        // 目标死亡
        if (target.hp <= 0) {
          bossDefeated = battle.enemyId === 'spirit_of_forest' && target.id === 'main'
          banditLeaderDefeated = battle.enemyId === 'p_bandit_leader' && target.id === 'main'
          handleTargetDeath(battle, target)
        }
      }
    }

    // 目标死亡可能触发群体逃跑并立即结束战斗，不能再继续结算佣兵或胜利。
    if (state._battle !== battle || state.phase !== 'battle') {
      EventBus.emit('battle:attack', { roll, result })
      return result
    }

    // 佣兵攻击：玩家命中后，佣兵补一刀（玩家 miss 时她也 miss）；发情时无法专心攻击
    const mercenary = state._mercenary
    if (mercenary && !mercenary.dead && (!window.MercenaryContractSystem || MercenaryContractSystem.supportAvailable()) && !result.hitSelf && !result.miss && battle.targets.length > 0 && state.hp > 0) {
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
          banditLeaderDefeated = battle.enemyId === 'p_bandit_leader' && mTarget.id === 'main'
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

    // 头目倒下后喽啰丢下赃物逃跑，不要求玩家逐个清场。
    if (banditLeaderDefeated) {
      const fleeing = battle.targets.filter(target => target.type === 'bandit').length
      battle.banditFleeingCrew = fleeing
      if (fleeing > 0) EventBus.emit('ui:log', { text: `🏃 头目倒下，剩余 ${fleeing} 名强盗丢下账册逃出桥洞！`, type: 'good' })
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

  /** 群居怪：只剩 1 只时溃逃，视为玩家击溃整支队伍。 */
  function checkPackFlee (battle) {
    const enemy = battle ? DATA.monster(battle.enemyId) : null
    if (!enemy || !enemy.props || !enemy.props.packHunt) return
    const aliveGoblins = battle.targets.filter(t => t.type === 'goblin').length
    if (aliveGoblins === 1) {
      EventBus.emit('ui:log', { text: '🏃 最后一只哥布林见势不妙，丢下战利品逃跑了！你击溃了整支队伍。', type: 'good' })
      end(true)
    }
  }

  /** 敌人成功逃跑：只结算少量金币，不计胜利、击杀与特殊掉落。 */
  function enemyEscape (reason) {
    const state = State.get()
    const battle = state._battle
    if (!battle) return false
    const enemyId = battle.enemyId
    const loot = LootSystem.collectEscape(enemyId, 0.25)
    state._battle = null
    state.phase = 'idle'
    EventBus.emit('state:changed', state)
    EventBus.emit('battle:end', { victory: false, enemyEscaped: true, reason, loot, enemyId })
    return true
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

    const baseChance = CONFIG.battle.fleeChance[state.difficulty] || 0.5
    const vibrationPenalty = !force && typeof RestraintSystem !== 'undefined' && RestraintSystem.vibrationEscapePenalty
      ? RestraintSystem.vibrationEscapePenalty()
      : 0
    const chance = Math.max(0.05, baseChance - vibrationPenalty)
    const roll = Math.random()
    const success = force ? true : (roll < chance)

    EventBus.emit('ui:log', { text: force ? '🏳️ 你选择投降……' : `🏃 尝试逃跑... (概率 ${Math.round(chance*100)}%${vibrationPenalty > 0 ? `，震动 -${Math.round(vibrationPenalty * 100)}%` : ''}) 掷骰: ${roll.toFixed(2)} ${success ? '✅ 成功！' : '❌ 失败！'}`, type: success ? 'good' : 'danger' })

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

  /**派克车队看守：取得当前尚未上锁的束缚。 */
  function caravanPendingBindings () {
    const battle = State.get()._battle
    if (!battle || battle.enemyId !== 'p_caravan_guard') return []
    if (!Array.isArray(battle.caravanBindings)) battle.caravanBindings = []
    return battle.caravanBindings.filter(binding => binding && !binding.locked)
  }

  /** 按项圈→手铐→口塞→肛塞的顺序佩戴；已占用的槽位只加车队封条，不覆盖玩家装备。 */
  function peekCaravanBinding () {
    const battle = State.get()._battle
    if (!battle) return null
    if (!Array.isArray(battle.caravanBindings)) battle.caravanBindings = []
    const activeStages = new Set(battle.caravanBindings.map(binding => binding.stage))
    const stage = CARAVAN_BINDING_SEQUENCE.findIndex((_, index) => !activeStages.has(index))
    if (stage < 0) return null
    return CARAVAN_BINDING_SEQUENCE[stage]
  }

  function applyCaravanBinding () {
    const state = State.get()
    const battle = state._battle
    if (!battle || battle.enemyId !== 'p_caravan_guard' || typeof RestraintSystem === 'undefined') return { ok: false }
    if (!Array.isArray(battle.caravanBindings)) battle.caravanBindings = []

    const activeStages = new Set(battle.caravanBindings.map(binding => binding.stage))
    const stage = CARAVAN_BINDING_SEQUENCE.findIndex((entry, index) => !activeStages.has(index))
    if (stage < 0) {
      battle.caravanFourfoldCapture = true
      end(false)
      return { ok: true, captured: true }
    }

    const entry = CARAVAN_BINDING_SEQUENCE[stage]
    const existing = RestraintSystem.get(entry.slot)
    let equipped = null
    if (!existing) {
      const result = RestraintSystem.equip(entry.slot, entry.id, {
        locked: false,
        source: 'p_caravan_guard',
        difficulty: stage + 2,
      }, true)
      if (!result.ok) return { ok: false, msg: result.msg }
      equipped = result.device
    }

    const record = {
      stage,
      slot: entry.slot,
      id: existing ? existing.id : entry.id,
      label: existing ? (RestraintSystem.defOf(existing.id)?.name || entry.label) : entry.label,
      icon: entry.icon,
      remaining: 2,
      locked: false,
      borrowed: !!existing,
      original: existing ? { ...existing } : null,
    }
    const device = existing || equipped
    if (device) device.caravanLockTurns = 2
    battle.caravanBindings.push(record)
    EventBus.emit('ui:log', { text: `${entry.icon} 看守扣上${record.label}：2 个行动回合后上锁。`, type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()
    return { ok: true, binding: record }
  }

  /** 挣脱未上锁的车队束缚；越后面的装置越难挣开。 */
  function struggleCaravanBinding (slot) {
    const state = State.get()
    const battle = state._battle
    if (!battle || !Array.isArray(battle.caravanBindings)) return { ok: false, msg: '没有可挣脱的车队束缚' }
    const index = battle.caravanBindings.findIndex(binding => binding.slot === slot && !binding.locked)
    if (index < 0) return { ok: false, msg: '这件束缚已经锁死' }
    const binding = battle.caravanBindings[index]
    const roll = Dice.d6()
    const target = Math.min(6, 3 + binding.stage)
    const success = roll >= target

    if (success) {
      const current = RestraintSystem.get(binding.slot)
      if (binding.borrowed) {
        if (binding.original) RestraintSystem.restore(binding.slot, { ...binding.original })
      } else if (current && current.source === 'p_caravan_guard') {
        RestraintSystem.restore(binding.slot, null)
      }
      battle.caravanBindings.splice(index, 1)
      EventBus.emit('ui:log', { text: `🎲 挣脱 ${roll}/${target}：你在锁扣咬死前打开了${binding.label}。`, type: 'good' })
    } else {
      EventBus.emit('ui:log', { text: `🎲 挣脱 ${roll}/${target}：${binding.label}没有松开。`, type: 'danger' })
    }
    EventBus.emit('state:changed', state)
    State.save()
    return { ok: success, roll, target, binding }
  }

  /** 玩家每消耗一个行动回合，所有待锁束缚同时推进。 */
  function tickCaravanBindings () {
    const state = State.get()
    const battle = state._battle
    if (!battle || battle.enemyId !== 'p_caravan_guard' || !Array.isArray(battle.caravanBindings)) return true

    let changed = false
    battle.caravanBindings.forEach(binding => {
      if (!binding || binding.locked) return
      binding.remaining = Math.max(0, Math.floor(Number(binding.remaining) || 0) - 1)
      const device = typeof RestraintSystem !== 'undefined' ? RestraintSystem.get(binding.slot) : null
      if (device) device.caravanLockTurns = binding.remaining
      changed = true
      if (binding.remaining > 0) {
        EventBus.emit('ui:log', { text: `⏳ ${binding.label}还有 ${binding.remaining} 个行动回合上锁。`, type: 'danger' })
        return
      }
      binding.locked = true
      if (device) {
        delete device.caravanLockTurns
        device.locked = true
        device.lockType = 'common'
        device.jammed = true
        device.source = 'p_caravan_guard'
      }
      EventBus.emit('ui:log', { text: `🔒 ${binding.label}的车队锁扣咬死了。`, type: 'danger' })
    })

    const locked = battle.caravanBindings.filter(binding => binding && binding.locked).length
    if (locked >= CARAVAN_BINDING_SEQUENCE.length) {
      battle.caravanFourfoldCapture = true
      EventBus.emit('ui:log', { text: '⛓️ 四道车队锁具全部闭合；你失去了继续作战的可能。', type: 'danger' })
      end(false)
      return false
    }
    if (changed) {
      EventBus.emit('state:changed', state)
      State.save()
    }
    return true
  }

  function releaseCaravanBindings (battle) {
    if (!battle || !Array.isArray(battle.caravanBindings) || typeof RestraintSystem === 'undefined') return
    battle.caravanBindings.forEach(binding => {
      const current = RestraintSystem.get(binding.slot)
      if (binding.borrowed && binding.original) {
        RestraintSystem.restore(binding.slot, { ...binding.original })
      } else if (current && current.source === 'p_caravan_guard') {
        RestraintSystem.restore(binding.slot, null)
      }
    })
    if (battle.caravanBindings.length) EventBus.emit('ui:log', { text: '🔑 看守倒下后，你找到锁匙，解掉了本场战斗加上的车队束缚。', type: 'good' })
  }

  function secureCaravanBindings (battle) {
    if (!battle || !Array.isArray(battle.caravanBindings) || typeof RestraintSystem === 'undefined') return
    battle.caravanBindings.forEach(binding => {
      binding.remaining = 0
      binding.locked = true
      const device = RestraintSystem.get(binding.slot)
      if (!device) return
      delete device.caravanLockTurns
      device.locked = true
      device.lockType = 'common'
      device.jammed = true
      device.source = 'p_caravan_guard'
    })
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
      if (battle.enemyId === 'p_caravan_guard') releaseCaravanBindings(battle)
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
      const wasElite = !!(battle.enemyState && battle.enemyState.elite)
      state._battle = null
      state.phase = 'idle'
      EventBus.emit('state:changed', state)
      EventBus.emit('battle:end', { victory: true, loot, enemyId: battle.enemyId, elite: wasElite, story: battle.story || null, caravanClothesTaken: !!battle.caravanClothesTaken, banditClothesTaken: !!battle.banditClothesTaken, banditFleeingCrew: Math.max(0, Number(battle.banditFleeingCrew) || 0) })
    } else {
      // 战败：树枝断裂
      if (!state.inventory.weapon && (state.inventory.consumables['twig'] || 0) > 0) {
        state.inventory.consumables['twig'] = 0
        EventBus.emit('ui:log', { text: '💔 战败中，树枝断裂了。', type: 'danger' })
      }
      const storyDefeat = ['commission-guard', 'commission-provoked', 'commission-bandits'].includes(battle.story)
      if (storyDefeat) {
        const banditHideout = battle.story === 'commission-bandits'
        const provoked = battle.story === 'commission-provoked'
        if (battle.enemyId === 'p_caravan_guard') {
          // 即使战斗中没有抽到“编号示众”，看守也会在装车前没收衣物。
          // 战败路线不会生成胜利后的找回衣服断点，因此全裸状态会保留到进城。
          if (!StatusSystem.has('naked')) {
            StatusSystem.apply('naked', 99999, { source: 'p_caravan_guard_defeat' })
            battle.caravanClothesTaken = true
            EventBus.emit('ui:log', { text: '👙 车队看守在装车前没收了你的全部衣物。', type: 'danger' })
          }
          secureCaravanBindings(battle)
        }
        const goldLost = Math.min(state.gold, banditHideout ? state.gold : provoked ? 30 : 12)
        const displayedGoldLost = banditHideout ? state.gold : goldLost
        if (!banditHideout) state.gold -= goldLost
        state.hp = Math.max(1, Math.ceil(state.maxHp * (provoked ? 0.25 : 0.5)))
        // 桥洞强盗只把玩家逐回旧桥；车队看守会把人送进雾灯镇。
        state.position = banditHideout ? { x: 10, y: 9 } : { x: 13, y: 9 }
        state._battle = null
        state.phase = 'idle'
        EventBus.emit('ui:log', { text: banditHideout
            ? `🗡️ 头目把你身上的 ${displayedGoldLost}G 全部搜走，准备把你留在桥洞里当几天飞机杯。`
            : `⛓️ 车队看守没有杀你。他们夺走 ${goldLost}G，把你捆上货车押回了雾灯镇。`, type: 'danger' })
        EventBus.emit('state:changed', state)
        State.save()
        const livingBandits = (battle.targets || []).filter(target => target.type === 'bandit' && target.hp > 0)
        EventBus.emit('battle:end', { victory: false, enemyId: battle.enemyId, story: battle.story, storyDefeat: true, goldLost: displayedGoldLost, provoked, banditHideout, banditClothesTaken: !!battle.banditClothesTaken, banditLivingCrew: livingBandits.length, banditLivingCrewIds: livingBandits.map(target => target.id), caravanClothesTaken: !!battle.caravanClothesTaken, caravanFourfoldCapture: !!battle.caravanFourfoldCapture, caravanBindings: Array.isArray(battle.caravanBindings) ? battle.caravanBindings.length : 0, caravanBindingRecords: Array.isArray(battle.caravanBindings) ? battle.caravanBindings.map(binding => ({ ...binding, original: binding.original ? { ...binding.original } : null })) : [] })
        return
      }
      // 你死了，佣兵也跟你一起倒下（死亡，可到商店花 50G 复活）
      if (state._mercenary && !state._mercenary.dead) {
        state._mercenary.dead = true
        EventBus.emit('ui:log', { text: `💔 ${state._mercenary.icon} ${state._mercenary.name} 替你挡下最后一击，倒在你身边……她没能活下来。可到商店花 50G 复活她。`, type: 'danger' })
      }
      state.phase = 'gameover'
      EventBus.emit('state:changed', state)
      EventBus.emit('battle:end', { victory: false, enemyId: battle.enemyId, story: battle.story || null })
      EventBus.emit('game:gameover', {})
    }
  }

  return { start, playerAttack, getTargets, mainTarget, removeTarget, end, defend, flee, enemyEscape, maybeEnrageCaravan, peekCaravanBinding, applyCaravanBinding, struggleCaravanBinding, tickCaravanBindings, caravanPendingBindings }
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
      if (def && def.onAttack) mod = { ...mod, ...def.onAttack(state, s, mod) }
    })

    // 混乱自伤在所有攻击修正完成后结算，确保困倦/醉酒等效果不会覆盖判定。
    // 原本未命中的攻击若转向自己，也至少会造成一次基础攻击伤害，不再出现“-0 HP”。
    if (mod.hitSelf) {
      let fallback = Math.max(1, Math.round(baseDmg * (accs.includes('sacrificial_necklace') ? 2 : 1)))
      if (mod.halved) fallback = Math.max(1, Math.floor(fallback / 2))
      mod.dmg = Math.max(1, Number(mod.dmg) || fallback)
      if (!state._godMode) state.hp -= mod.dmg
    }

    return { roll, dmg: mod.dmg, crit: mult === cfg.critMult, miss: mult === 0, hitSelf: mod.hitSelf || false, stunned: mod.stunned || false }
  },
}
