/**
 * systems/loot.js — 战利品系统
 *
 * 职责：
 *  - 击败敌人后收集基础金币
 *  - 掷 Z 判定额外掉落
 *  - 处理特殊掉落逻辑（触手断体、兽人尸体、魔女召唤等）
 *
 * 事件：战斗结束时由 BattleSystem 调用
 */

window.LootSystem = (function () {
  /**
   * 收集战利品
   * @param {string} enemyId
   * @returns {object} { gold, drops: [{ itemId? }] }
   */
  function collect (enemyId, rollOverride) {
    const state = State.get()
    const enemy = DATA.monster(enemyId)
    if (!enemy) return { gold: 0, drops: [] }

    const result = { gold: 0, drops: [] }

    // 基础金币
    if (enemy.id === 'goblins') {
      const initialCount = state._battle ? (state._battle.goblinInitialCount || 3) : 3
      result.gold = enemy.loot.gold * initialCount
    } else {
      result.gold = enemy.loot.gold
    }

    // 精英怪：基础金币提高 50%。精英状态保存在当前战斗中，读档后仍可恢复。
    const elite = state._battle && state._battle.enemyState && state._battle.enemyState.elite
    if (elite && !enemy.props?.storyEncounter) result.gold = Math.ceil(result.gold * (CONFIG.battle.eliteGoldMult || 1.5))

    // 贪婪恶魔翻倍
    if (StatusSystem.has('greed_demon')) result.gold *= 2

    // 妖缚：上锁装置金币加成（每件 +5%，上限 +30%）
    if (typeof RestraintSystem !== 'undefined') {
      const bonus = RestraintSystem.goldBonus()
      if (bonus > 0) {
        const add = Math.floor(result.gold * bonus)
        result.gold += add
        EventBus.emit('ui:log', { text: `⛓️ 妖缚装置让战利品多了 ${add}G（+${Math.round(bonus * 100)}%）。`, type: 'good' })
      }
    }

    state.gold += result.gold

    // 掷 Z 额外掉落（魅魔已触发过临死反击则重掷 4；外部传入 rollOverride 时共用结果）
    let z
    if (rollOverride) {
      z = rollOverride
    } else {
      while (true) {
        z = Dice.rollZ()
        if (enemy.id === 'succubus' && state._battle?.succubusDeathRattleDone && z === 4) continue
        break
      }
    }

    if (enemy.loot.drops) {
      const drop = enemy.loot.drops.find(d => d.roll === z)
      if (drop) {
        if (drop.itemId) {
          const ddDef = typeof RestraintSystem !== 'undefined' ? RestraintSystem.defOf(drop.itemId) : null
          if (ddDef && ddDef.insert) {
            const granted = RestraintSystem.grant(drop.itemId)
            if (granted.owned) {
              const compensation = Math.max(1, Math.floor((ddDef.price || 0) / 2))
              state.gold += compensation
              EventBus.emit('ui:log', { text: `🎁 已拥有${ddDef.name}，重复掉落折算为 ${compensation}G。`, type: 'good' })
            }
          } else state.inventory.consumables[drop.itemId] = (state.inventory.consumables[drop.itemId] || 0) + 1
          result.drops.push({ itemId: drop.itemId })
        }
        if (drop.status) {
          StatusSystem.apply(drop.status, drop.turns, { level: drop.level || 1, source: 'player' })
          result.drops.push({ type: 'status', id: drop.status })
          // 剧情说明（可选）
          if (drop.flavor) EventBus.emit('ui:log', { text: drop.flavor, type: 'good' })
        }
        if (drop.special === 'stolen_gold' && drop.gold) {
          const actualLoss = Math.min(state.gold, drop.gold)
          state.gold = Math.max(0, state.gold - drop.gold)
          result.drops.push({ type: 'gold_loss', gold: actualLoss, requested: drop.gold })
        }
        if (drop.special === 'werewolf_final') {
          result.werewolfFinal = true
          result.drops.push({ type: 'werewolf_final' })
        }
        if (drop.special === 'tentacle_embedded') {
          result.tentacleEmbedded = true
          result.drops.push({ type: 'tentacle_embedded' })
        }
        if (drop.special === 'reroll_encounter') {
          result.rerollEncounter = true
          result.drops.push({ type: 'reroll_encounter' })
        }
      }
    }

    // 精英怪必定掉落一枚异变结晶；与普通掷骰掉落并存。
    if (elite && !enemy.props?.storyEncounter) {
      state.inventory.consumables.mutant_crystal = (state.inventory.consumables.mutant_crystal || 0) + 1
      result.drops.push({ itemId: 'mutant_crystal', elite: true })
    }

    return result
  }

  /** 敌人成功逃跑时，只留下少量金币，不触发掷骰、特殊掉落或精英材料。 */
  function collectEscape (enemyId, fraction = 0.25) {
    const state = State.get()
    const enemy = DATA.monster(enemyId)
    if (!enemy) return { gold: 0, drops: [] }
    let base = enemy.loot.gold || 0
    if (enemy.id === 'goblins') {
      const count = state._battle ? (state._battle.goblinInitialCount || 3) : 3
      base *= count
    }
    if (state._battle?.enemyState?.elite) base = Math.ceil(base * (CONFIG.battle.eliteGoldMult || 1.5))
    const gold = Math.max(0, Math.floor(base * fraction))
    state.gold += gold
    return { gold, drops: [], partial: true }
  }

  return { collect, collectEscape }
})()
