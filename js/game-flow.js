/**
 * game-flow.js — 应用流程编排层。
 * 领域系统不再彼此反向调用；场景切换与剧情战结果统一从这里分派。
 */
window.GameFlow = (function () {
  function afterArrive (tile, x, y) {
    if (tile) NodeEvents.trigger(tile, x, y)
    else afterEvent()
  }

  function afterEvent () {
    EventBus.emit('game:readyToMove', {})
  }

  function startBattle (enemyId, options = {}) {
    return BattleSystem.start(enemyId, options)
  }

  function openCamp (options) {
    return CampSystem.open(options)
  }

  function resumeCampStory () {
    if (typeof CommissionSystem !== 'undefined' && CommissionSystem.resumeCampStory) {
      return CommissionSystem.resumeCampStory()
    }
    return false
  }

  function resumeStory () {
    if (typeof CommissionSystem !== 'undefined' && CommissionSystem.resumePending) {
      return CommissionSystem.resumePending()
    }
    return false
  }

  function handleBattleVictory (result) {
    if (result && result.enemyId === 'p_hall_enforcers' && result.story === 'p-hall-assault') {
      PTownSystem.resolvePHallBattle(true, result)
      return true
    }
    return !!(typeof CommissionSystem !== 'undefined' && CommissionSystem.afterBattle && CommissionSystem.afterBattle(result))
  }

  function handleBattleDefeat (result) {
    if (result && result.enemyId === 'p_hall_enforcers' && result.story === 'p-hall-assault') {
      PTownSystem.resolvePHallBattle(false, result)
      return true
    }
    return !!(typeof CommissionSystem !== 'undefined' && CommissionSystem.afterDefeat && CommissionSystem.afterDefeat(result))
  }

  return { afterArrive, afterEvent, startBattle, openCamp, resumeCampStory, resumeStory, handleBattleVictory, handleBattleDefeat }
})()
