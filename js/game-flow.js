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

  function retreatToPrevious () {
    return !!(typeof MovementController !== 'undefined' && MovementController.retreatToPrevious && MovementController.retreatToPrevious())
  }

  function resumeCampStory () {
    if (typeof PrologueSystem !== 'undefined' && PrologueSystem.resumeCampStory) {
      return PrologueSystem.resumeCampStory()
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
    if (typeof PrologueSystem !== 'undefined' && PrologueSystem.resumePending) {
      return PrologueSystem.resumePending()
    }
    return false
  }

  function handleBattleVictory (result) {
    const enemy = result && typeof DATA !== 'undefined' ? DATA.monster(result.enemyId) : null
    if (enemy && enemy.storyHooks && typeof enemy.storyHooks.onVictory === 'function') return !!enemy.storyHooks.onVictory(result)
    return !!(typeof PrologueSystem !== 'undefined' && PrologueSystem.afterBattle && PrologueSystem.afterBattle(result))
  }

  function handleBattleDefeat (result) {
    const enemy = result && typeof DATA !== 'undefined' ? DATA.monster(result.enemyId) : null
    if (enemy && enemy.storyHooks && typeof enemy.storyHooks.onDefeat === 'function') return !!enemy.storyHooks.onDefeat(result)
    return !!(typeof PrologueSystem !== 'undefined' && PrologueSystem.afterDefeat && PrologueSystem.afterDefeat(result))
  }

  return { afterArrive, afterEvent, retreatToPrevious, startBattle, openCamp, resumeCampStory, resumeStory, handleBattleVictory, handleBattleDefeat }
})()
