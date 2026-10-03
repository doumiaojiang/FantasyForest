const fs = require('fs')
const assert = require('assert')

const read = file => fs.readFileSync(file, 'utf8')
const moduleSource = read('js/systems/p-m-enslavement.js')
const catchingSource = read('js/systems/p-catching-ivana.js')
const escortSource = read('js/systems/p-m-escort.js')
const campSource = read('js/systems/camp.js')
const journalSource = read('js/ui/journal.js')
const gameFlowSource = read('js/game-flow.js')
const html = read('index.html')

assert(html.includes('js/systems/p-m-enslavement.js'), '入库章节模块必须由 index.html 加载')
assert(html.includes('js/systems/p-catching-ivana.js'), '捕获伊凡娜任务模块必须由 index.html 独立加载')
assert(html.includes('js/systems/p-m-escort.js'), '九格押送小游戏必须由独立脚本加载')
assert(moduleSource.includes("state().gender === 'male' ? '菊穴' : '小穴'"), '任务部位必须按角色性别分流')

for (const stage of [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 9500]) {
  assert(moduleSource.includes(String(stage)), `缺少入库阶段 ${stage}`)
}

assert(moduleSource.includes('function confiscateOnKnockout'), '被打晕后必须执行独立没收流程')
assert(moduleSource.includes('s.gold = 0') && moduleSource.includes('s.inventory.consumables = {}'), '金币和道具必须全部没收')
assert(moduleSource.includes('s._restraints = {}') && moduleSource.includes('s._prostituteGear = {}'), '妖缚和姓女装备必须全部解除')
assert(!moduleSource.includes('s.inventory.weapon = escrow.weapon || null'), '结章不得自动归还被没收武器')
for (const expected of ["wearWakeGear('eyes', 'blindfold')", "wearWakeGear('mouth', 'leather_gag')", "wearWakeGear('arms', 'handcuffs')", "wearWakeGear('legs', 'leg_cuffs')"]) {
  assert(moduleSource.includes(expected), `醒来前缺少临时束缚：${expected}`)
}
assert(!moduleSource.includes('临时束缚确认') && !moduleSource.includes('确认四件均已佩戴'), '不应保留说明书式束缚确认页')
for (const scene of ['showWakeBlindfoldEquip', 'showWakeGagEquip', 'showWakeCuffsEquip', 'showWakeLegCuffsEquip']) assert(moduleSource.includes(`function ${scene}`), `缺少逐件佩戴演出：${scene}`)
assert(moduleSource.includes('s._pMChapterCompleted = true'), '结章必须以 M 第一章完成状态为唯一依据')
assert(catchingSource.includes('本轮只实现 Stage 0 贝拉米交接') && catchingSource.includes('伊凡娜登场、WalkOfShame 戴蒙德押送、Stage 500 起'), '后续任务只能开放捕获伊凡娜 Stage 0 交接')
assert((moduleSource.includes('锁具间') || moduleSource.includes('城门 · 笼子前')) && moduleSource.includes('function showIntakeWash') && moduleSource.includes('function showIntakeShave'), '入库中段必须包含清洗与剪理')
for (const removed of ['function showStage2000Forced', 'function returnToBellamy', 'function showSisterBinding', 'function showMarketChoice', 'function showBranding', 'function showPikeSecondAudience', 'function completeChapter']) {
  assert(!moduleSource.includes(removed), `第一章不得保留未启用的旧后续实现：${removed}`)
}
assert(moduleSource.includes("source: 'p_m_intake'"), '正式锁具必须使用独立剧情来源')
assert(moduleSource.includes("equip('anal', 'medium_butt_plug'") && moduleSource.includes("attachment: 'prostitute_tag'") && moduleSource.includes("equip('vagina', 'vibrating_dildo'") && moduleSource.includes("attachment: 'bell'"), '2500 后必须装备M码插入装备并连接剧情挂饰')
assert(moduleSource.includes("branch === 'experienced'") && moduleSource.includes('showStage2500Survivor'), '1500/2500 必须按性经历分支显示不同对白')
assert(moduleSource.includes("action.tone === 'submit'") && moduleSource.includes("normalized.cls = 'btn-submissive'"), '顺从选项必须统一使用粉色语义按钮')
assert(moduleSource.includes("action.tone === 'resist'") && moduleSource.includes("normalized.cls = 'btn-danger'"), '反抗选项必须统一使用红色语义按钮')
assert(moduleSource.includes('function showStage3500') && moduleSource.includes('function showStage4000'), '必须实现3000之后的评估与命令阶段')
for (const taskName of ["name: '口部验收'", "name: '小穴验收'", "name: '正面验收'", "name: '菊穴验收'", "name: '抗命处罚'"]) {
  assert(moduleSource.includes(taskName), `原版 SexLab/ZaZ 演出必须转换为可操作任务：${taskName}`)
}
assert(!moduleSource.includes('case 9500: setStage(4000)'), '完成档不得在运行时把 9500 回退到 4000')
assert(moduleSource.includes("page === 'command-punished'") && moduleSource.includes('commandPunishmentCompleted: true'), 'Stage 4000 刑架处罚必须保存并能恢复完成页')
assert(moduleSource.includes('finishChapterAndStartIvana') && moduleSource.includes('s._pMChapterStage = 9500'), '确认命令必须在9500完成第一章')
assert(moduleSource.includes('PCatchingIvanaSystem.start()'), '结章必须启动独立的捕获伊凡娜任务')
assert(moduleSource.includes('case 3500: resumeStage3500()') && moduleSource.includes('case 4000: resumeStage4000()'), '3500与4000不得再进入旧押送流程')
assert(escortSource.includes("const BOARD = ['start', 'event', 'empty', 'event', 'guard', 'event', 'empty', 'event', 'finish']"), '押送棋盘必须保持固定九格结构')
assert(escortSource.includes('const EVENTS = [') && escortSource.includes('const GUARD_EVENTS = ['), '街道和卫兵事件表必须集中在独立模块顶部')
assert(escortSource.includes('function punishRefusal') && escortSource.includes('refusedPosition >= 4 ? 4 : 0'), '反抗必须退回上一处检查点')
assert(moduleSource.includes('PMEscortSystem.start') && moduleSource.includes('PMEscortSystem.resume()'), '入库章节必须能开始并恢复独立押送小游戏')
assert(moduleSource.includes("name: '挨打'"), '醒来的命令必须保留可操作的身体任务')

assert(campSource.includes('data-opt="p-m-chapter"'), '营地必须提供可恢复的入库入口')
assert(campSource.includes('data-opt="p-catching-ivana"'), '营地必须提供捕获伊凡娜入口')
assert(journalSource.includes('奴隶线·第一章'), '札记必须显示奴隶线第一章')
assert(!moduleSource.includes("title: '⛓️ stage"), '玩家可见标题不应暴露内部 stage 编号')
assert(gameFlowSource.includes('state._pMConfiscated && !state._pMChapterCompleted') && gameFlowSource.includes('PMEnslavementSystem.open()'), '继续游戏必须优先恢复正在进行的入库剧情')
assert(gameFlowSource.includes('PCatchingIvanaSystem.open()'), '继续游戏必须优先恢复捕获伊凡娜 Stage 0')

global.window = global
let currentScene = null
const testState = {
  gender: 'female', _pRole: 'slave', _pMainlineStage: 2, _pMChapterCompleted: false,
  _pMChapterStage: 0, _pMChapterStep: 0, gold: 88,
  inventory: { weapon: 'twig', accessory: 'ring_of_love', accessories: ['ring_of_love'], consumables: { bandaid: 3 } },
  ownedEquipment: ['twig', 'ring_of_love'],
  _restraints: { neck: { id: 'slut_collar', locked: false } },
  _ownedRestraints: ['slut_collar'], _ownedRestraintCounts: { slut_collar: 1 },
  _prostituteGear: { collar: true }, _ownedProstituteGear: ['slut_collar'], _equippedProstituteGear: { neck: 'slut_collar' }, _prostituteDressed: true,
}
global.State = { get: () => testState, save: () => {} }
global.EventBus = { emit: () => {} }
global.CampSystem = { open: () => {}, showScene: scene => { currentScene = scene } }
global.Dialog = { close: () => {} }
;(0, eval)(catchingSource)
;(0, eval)(moduleSource)

PMEnslavementSystem.open()
assert.equal(currentScene.title, '⛓️ 城门 · 收容笼')
assert.equal(testState._pMChapterStage, 0)
assert.equal(currentScene.actions[0].label, '……')
assert.equal(testState._pMConfiscated, true)
assert.equal(testState.gold, 0)
assert.equal(testState.inventory.weapon, null)
assert.deepEqual(testState.inventory.consumables, {})
assert.deepEqual(testState.ownedEquipment, [])
assert.deepEqual(testState._restraints, {})
assert.deepEqual(testState._prostituteGear, {})
assert.equal(testState._pMConfiscationEscrow.gold, 88)

testState._pMChapterStage = 3500
testState._pMChapterStep = 0
testState._pMChapterBranch = 'novice'
testState._pMFirstAudience = {
  version: 1, page: 'assessment-question', arrivalResponse: 'obey', identityResponse: 'accept',
  assessmentVariant: null, assessmentViewed: false,
  commandReasonAsked: false, commandObjected: false, commandPunishmentCompleted: false,
  removedGear: [], commandConfirmed: false,
}
PMEnslavementSystem.open()
assert.equal(currentScene.title, '🏛️ 商团会馆 · 长厅')
currentScene.actions[0].handler()
assert.equal(currentScene.title, '🏛️ 商团会馆 · 初步评估')
assert.equal(testState._pMFirstAudience.assessmentVariant, 'novice')
assert.equal(testState._pMFirstAudience.assessmentViewed, true)
currentScene.actions[0].handler()
assert.equal(testState._pMChapterStage, 4000)
assert.equal(currentScene.title, '🏛️ 商团会馆 · 派克的命令')
currentScene.actions[1].handler()
assert.equal(testState._pMFirstAudience.commandReasonAsked, true)
PMEnslavementSystem.open()
assert(currentScene.body.includes('下一次评估的开始') || currentScene.body.includes('这是命令'), '命令理由页刷新后必须恢复原页面')
currentScene.actions[0].handler()
currentScene.actions[0].handler()
assert.equal(testState._pMFirstAudience.commandConfirmed, true)
assert.equal(currentScene.title, '📜 奴隶线后续任务 · 捕获伊凡娜')
assert.equal(testState._pMChapterStage, 9500)
assert.equal(testState._pMChapterCompleted, true)
assert.equal(testState._pMainlineStage, 6)
assert.deepEqual(testState._pCatchingIvana, { version: 1, stage: 0, page: 'objective', started: true, completed: false })
PCatchingIvanaSystem.open()
assert.equal(currentScene.title, '📜 奴隶线后续任务 · 捕获伊凡娜', '读档必须恢复新任务 Stage 0 目标页')
assert(currentScene.body.includes('返回城门') && currentScene.body.includes('贝拉米'), 'Stage 0 必须显示派克的口信目标')
testState._pCatchingIvana.page = 'saved-page'
const sameQuest = testState._pCatchingIvana
PCatchingIvanaSystem.start()
assert.strictEqual(testState._pCatchingIvana, sameQuest, '重复启动不得替换后续任务存档对象')
assert.equal(testState._pCatchingIvana.page, 'saved-page', '重复启动不得重置已保存页面')
assert.equal(testState.inventory.weapon, null)
assert.deepEqual(testState.inventory.accessories, [])

console.log('m-enslavement-ok')
