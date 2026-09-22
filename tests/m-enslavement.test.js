const fs = require('fs')
const assert = require('assert')

const read = file => fs.readFileSync(file, 'utf8')
const moduleSource = read('js/systems/p-m-enslavement.js')
const storySource = read('js/systems/camp-p-story.js')
const campSource = read('js/systems/camp.js')
const journalSource = read('js/ui/journal.js')
const gameFlowSource = read('js/game-flow.js')
const html = read('index.html')

assert(html.includes('js/systems/p-m-enslavement.js'), '入库章节模块必须由 index.html 加载')
assert(moduleSource.includes("state().gender === 'male' ? '菊穴' : '小穴'"), '任务部位必须按角色性别分流')

for (const stage of [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 9500, 10000]) {
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
assert(moduleSource.includes("s._pDayaOutcome = 'm_intake_complete'"), '结章必须写入独立的 M 入库结果')
assert(moduleSource.includes('下一任务是寻找伊凡娜；基础奴隶训练尚未开始'), '第一章不得误开基础训练')
assert((moduleSource.includes('锁具间') || moduleSource.includes('城门 · 笼子前')) && moduleSource.includes('function showIntakeWash') && moduleSource.includes('function showIntakeShave'), '入库中段必须包含清洗与剪理')
assert(moduleSource.includes('奴隶姐妹') && moduleSource.includes('市场中央') && moduleSource.includes('奴隶纹身') && moduleSource.includes('纹身与烙印'), '押送必须包含姐妹链、市场、纹身与烙印')
assert(moduleSource.includes("source: 'p_m_intake'"), '正式锁具必须使用独立剧情来源')
assert(moduleSource.includes("equip('anal', 'medium_butt_plug'") && moduleSource.includes("equip('vagina', 'small_dildo'"), '2500 后必须把原版塞子实际同步到妖缚栏')
assert(moduleSource.includes("branch === 'experienced'") && moduleSource.includes('showStage2500Survivor'), '1500/2500 必须按性经历分支显示不同对白')
assert(moduleSource.includes("action.tone === 'submit'") && moduleSource.includes("normalized.cls = 'btn-submissive'"), '顺从选项必须统一使用粉色语义按钮')
assert(moduleSource.includes("action.tone === 'resist'") && moduleSource.includes("normalized.cls = 'btn-danger'"), '反抗选项必须统一使用红色语义按钮')
assert(moduleSource.includes('showStage3000ReleaseEnd') && moduleSource.includes('showPikeFirstAudience({ stopAtStage3000: true })'), '当前发布范围必须在完整 Stage 3000 会面后暂停')
assert(moduleSource.includes("s._pMDayaChoice === 'protect'") && moduleSource.includes("name: '挨打'"), '醒来的命令必须是身体任务，押送选择仍要影响后果')

assert(storySource.includes('PMEnslavementSystem.returnToBellamy()'), '返回城门必须交给入库章节恢复')
assert(storySource.includes('PMEnslavementSystem.completeChapter()'), '第二次派克会面必须完成入库章节')
assert(campSource.includes('data-opt="p-m-chapter"'), '营地必须提供可恢复的入库入口')
assert(journalSource.includes('欲缚镇 · 奴役线第一章'), '札记必须显示奴役线第一章')
assert(!moduleSource.includes("title: '⛓️ stage"), '玩家可见标题不应暴露内部 stage 编号')
assert(gameFlowSource.includes('state._pMConfiscated && !state._pMChapterCompleted') && gameFlowSource.includes('PMEnslavementSystem.open()'), '继续游戏必须优先恢复正在进行的入库剧情')

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

PMEnslavementSystem.completeChapter()
assert.equal(testState._pMChapterStage, 10000)
assert.equal(testState._pMChapterCompleted, true)
assert.equal(testState._pDayaOutcome, 'm_intake_complete')
assert.equal(testState.inventory.weapon, null)
assert.deepEqual(testState.inventory.accessories, [])

console.log('m-enslavement-ok')
