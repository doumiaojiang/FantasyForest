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

    // 贪婪恶魔翻倍
    if (StatusSystem.has('greed_demon')) result.gold *= 2

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
          state.inventory.consumables[drop.itemId] = (state.inventory.consumables[drop.itemId] || 0) + 1
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

    return result
  }

  return { collect }
})()