/**
 * 《欲缚镇 · 序章》统一流程入口。
 *
 * 本文件只负责把地图、营地、战斗结算和镇内剧情接到同一个公开接口；
 * 可编辑文字统一放在 data/stories/prologue.js，怪物专属内容放在对应怪物文件。
 * 镇内和野外运行模块均为内部实现；游戏其他位置只能调用 PrologueSystem。
 */
window.PrologueSystem = (function () {
  const wilderness = () => window.__PrologueRuntime && window.__PrologueRuntime.wilderness
  const town = () => window.__PrologueRuntime && window.__PrologueRuntime.town

  function call (owner, method, args) {
    const target = owner()
    if (!target || typeof target[method] !== 'function') return false
    return target[method](...args)
  }

  return {
    // 地图与野外序章
    visitBridge: (...args) => call(wilderness, 'visitBridge', args),
    visitBanditCamp: (...args) => call(wilderness, 'visitBanditCamp', args),
    inspectCaravanWreck: (...args) => call(wilderness, 'inspectCaravanWreck', args),
    enterBanditHideout: (...args) => call(wilderness, 'enterBanditHideout', args),
    afterBattle: (...args) => call(wilderness, 'afterBattle', args),
    afterDefeat: (...args) => call(wilderness, 'afterDefeat', args),
    handleMonsterVictory: (enemyId, result) => result && result.enemyId === enemyId && call(wilderness, 'afterBattle', [result]),
    handleMonsterDefeat: (enemyId, result) => result && result.enemyId === enemyId && call(wilderness, 'afterDefeat', [result]),
    resumeMonsterStory: () => call(wilderness, 'resumePending', []),
    resumeCampStory: (...args) => call(wilderness, 'resumeCampStory', args),
    resumePending: (...args) => call(wilderness, 'resumePending', args),
    resumeCaravanEscort: (...args) => call(wilderness, 'resumeCaravanEscort', args),
    resumeDefeatDispatch: (...args) => call(wilderness, 'resumeDefeatDispatch', args),
    letterAfterText: state => PROLOGUE_CONTENT.letterAfterText(state || State.get()),

    // 镇内调查、城门换岗与后续入口
    pTownHall: (...args) => call(town, 'pTownHall', args),
    investigatePTown: (...args) => call(town, 'investigatePTown', args),
    showPGateChapter: (...args) => call(town, 'showPGateChapter', args),

    // 酒馆、铁匠等地点只通过此入口写入序章调查状态。
    recordLead: kind => {
      if (window.CampSystem && typeof CampSystem.recordCommissionLead === 'function') return CampSystem.recordCommissionLead(kind)
      return false
    },
  }
})()
