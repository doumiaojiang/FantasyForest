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
    const state = typeof State !== 'undefined' && State.get ? State.get() : null
    // 「入库」是由一连串弹窗组成的任务。存档的 phase 仍是 camp，因此必须在
    // 普通营地恢复之前接回当前章节，否则“继续游戏”只会把玩家送回营地首页。
    if (state && state._pRole === 'slave' && state._pMConfiscated && !state._pMChapterCompleted &&
      typeof PMEnslavementSystem !== 'undefined' && PMEnslavementSystem.open) {
      PMEnslavementSystem.open()
      return true
    }
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
