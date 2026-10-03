const fs = require('fs')
const assert = require('assert')

global.window = global
let currentScene = null
let campOpened = 0
const taskCalls = []
const worn = {}
const state = {
  gender: 'female', playerName: '阶段测试', phase: 'camp',
  _pRole: 'slave', _pMainlineStage: 2, _pChapterOneLocked: true,
  _pMChapterStage: 3000, _pMChapterStep: 0, _pMChapterCompleted: false,
  _pMChapterBranch: 'novice', _pMConfiscated: true, _pMChapterFailures: 0,
  _pMEscortMode: 'solo', _pMEscort: null,
  _pMFirstAudience: null,
  _pCatchingIvana: null,
}

function audienceDefaults () {
  return {
    version: 1, page: 'arrival', arrivalResponse: null, identityResponse: null,
    assessmentVariant: null, assessmentViewed: false,
    commandReasonAsked: false, commandObjected: false, commandPunishmentCompleted: false,
    removedGear: [], commandConfirmed: false,
  }
}

global.State = { get: () => state, save: () => {} }
global.EventBus = { emit: () => {} }
global.CampSystem = { open: () => { campOpened += 1; currentScene = { title: '⛺ 林缘营地', actions: [] } }, showScene: scene => { currentScene = scene } }
global.Dialog = { close: () => {} }
global.BattleUI = { showTaskDialog: async options => { taskCalls.push(options); return false } }
global.RestraintSystem = {
  get: slot => worn[slot] || null,
  remove: slot => { delete worn[slot] },
}
global.PCatchingIvanaSystem = {
  start: () => {
    state._pCatchingIvana = { version: 1, stage: 0, page: 'objective', started: true, completed: false }
    currentScene = { title: '📜 奴隶线后续任务 · 捕获伊凡娜', actions: [] }
  },
}

;(0, eval)(fs.readFileSync('js/systems/p-m-enslavement.js', 'utf8'))
const catchingSource = fs.readFileSync('js/systems/p-catching-ivana.js', 'utf8')
;(0, eval)(catchingSource)

async function settle () {
  await Promise.resolve()
  await Promise.resolve()
}

function reset (overrides = {}) {
  campOpened = 0
  taskCalls.length = 0
  Object.keys(worn).forEach(key => { delete worn[key] })
  Object.assign(state, {
    gender: 'female', playerName: '阶段测试', phase: 'camp',
    _pRole: 'slave', _pMainlineStage: 2, _pChapterOneLocked: true,
    _pMChapterStage: 3000, _pMChapterStep: 0, _pMChapterCompleted: false,
    _pMChapterBranch: 'novice', _pMConfiscated: true, _pMChapterFailures: 0,
    _pMEscortMode: 'solo', _pMEscort: null,
    _pMFirstAudience: audienceDefaults(),
    _pCatchingIvana: null,
  }, overrides)
}

async function click (index = 0) {
  const action = currentScene.actions[index]
  const result = action.handler()
  if (result && typeof result.then === 'function') await result
  await settle()
}

async function playInspection (expectedNames) {
  for (const expected of expectedNames) {
    assert.equal(currentScene.title, '🏛️ 商团会馆 · 派克检查')
    assert.notEqual(currentScene.actions[0].cls, 'btn-danger', '强制检查动作不应显示为反抗红色')
    await click(0)
    assert.equal(taskCalls[taskCalls.length - 1].attackName, expected)
    assert.equal(currentScene.title, '🏛️ 商团会馆 · 派克检查')
    await click(0)
  }
}

async function fromIdentityTo4000 (expectedNames) {
  await click(0)
  assert.equal(state._pMFirstAudience.identityResponse, 'accept')
  assert.equal(state._pMFirstAudience.page, 'identity-accepted')
  PMEnslavementSystem.open()
  assert(currentScene.body.includes('以后叫我奴隶主'), '身份回答后的派克回应必须能在刷新后恢复')
  await click(0)
  await playInspection(expectedNames)
  assert.equal(state._pMChapterStage, 3500)
  assert.equal(currentScene.actions.length, 1)
  assert(currentScene.actions[0].label.includes('您看出结果了吗'))
  await click(0)
  assert.equal(state._pMFirstAudience.assessmentViewed, true)
  await click(0)
  assert.equal(state._pMChapterStage, 4000)
}

async function run () {
  const moduleSource = fs.readFileSync('js/systems/p-m-enslavement.js', 'utf8')
  assert(!moduleSource.includes('case 9500: setStage(4000)'), '运行时不得把 9500 回退到 4000')
  assert(!moduleSource.includes('那份记录究竟有什么用'), '3500 不得再把记录用途问项当主线')
  assert(!moduleSource.includes('function showAssessmentRecordPurpose'))
  assert(!moduleSource.includes('母猪蹲'))
  assert(moduleSource.includes("name: '正面验收'"))
  assert(moduleSource.includes('没有小穴。先看正面、锁具和反应。'))
  assert(!moduleSource.includes('“没有穴。'))
  assert(catchingSource.includes('WalkOfShame'))
  assert(catchingSource.includes('showBellamyAsk'))
  assert(catchingSource.includes('伊凡娜登场、戴蒙德当街押送'))

  reset()
  PMEnslavementSystem.open()
  assert.equal(currentScene.title, '🏛️ 商团会馆 · 长厅')
  assert(currentScene.body.includes('下唇'), '没有剧情口塞时应直接进入可说话的登记问答')
  await fromIdentityTo4000(['口部验收', '小穴验收', '菊穴验收'])
  assert.equal(state._pMFirstAudience.assessmentVariant, 'novice')
  assert(currentScene.body.includes('基础训练'))
  assert(currentScene.body.includes('戴蒙德'))

  worn.eyes = { id: 'blindfold', source: 'p_m_intake' }
  PMEnslavementSystem.open()
  const gearAction = currentScene.actions.find(action => action.label === '请求取下眼部装备')
  assert(gearAction, '只在实际佩戴本章眼罩时提供装备调整')
  gearAction.handler()
  assert.equal(worn.eyes, undefined)
  assert.deepEqual(state._pMFirstAudience.removedGear, ['eyes'])
  await click(0)

  const objection = currentScene.actions.find(action => action.label.includes('不接受'))
  objection.handler()
  await click(0)
  assert.equal(taskCalls[taskCalls.length - 1].attackName, '抗命处罚')
  assert.equal(state._pMFirstAudience.commandPunishmentCompleted, true)
  assert.equal(currentScene.title, '🏛️ 商团会馆 · 抗命处罚结束')
  await click(0)
  assert(currentScene.actions.some(action => action.label === '“是，奴隶主。”'), '处罚完成后仍返回命令')

  const accept = currentScene.actions.find(action => action.label === '“是，奴隶主。”')
  accept.handler()
  assert.equal(state._pMChapterStage, 9500)
  assert.equal(state._pMChapterCompleted, true)
  assert.equal(state._pMainlineStage, 6)
  assert.equal(state._pCatchingIvana.stage, 0)
  assert.equal(currentScene.title, '📜 奴隶线后续任务 · 捕获伊凡娜')

  reset({
    _pMChapterStage: 3000,
    _pMEscortMode: 'bellamy',
  })
  worn.mouth = { id: 'leather_gag', source: 'p_m_intake' }
  PMEnslavementSystem.open()
  assert(currentScene.body.includes('城门新登记的'))
  assert.deepEqual(currentScene.actions.map(action => action.label), ['点头', '摇头', '含着口塞发出呜咽'])
  await click(0)
  assert.equal(worn.mouth, undefined)
  assert.equal(state._pMFirstAudience.arrivalResponse, 'obey')
  assert(currentScene.body.includes('知不知道自己现在是什么'))

  reset({
    _pMChapterStage: 3000,
    _pMEscortMode: 'solo',
  })
  worn.mouth = { id: 'leather_gag', source: 'p_m_intake' }
  PMEnslavementSystem.open()
  assert(currentScene.body.includes('自己把链子'))
  assert(!currentScene.body.includes('城门新登记的'))
  await click(2)
  assert.equal(state._pMFirstAudience.arrivalResponse, 'muffle')
  assert.equal(worn.mouth, undefined)

  reset({
    _pMChapterStage: 3000,
    _pMEscortMode: 'solo',
  })
  PMEnslavementSystem.open()
  await click(1)
  assert.equal(state._pMFirstAudience.page, 'identity-objected')
  PMEnslavementSystem.open()
  assert(currentScene.body.includes('还敢谈条件'), '提出异议后的派克回应必须能在刷新后恢复')

  reset({
    gender: 'female',
    _pMChapterBranch: 'experienced',
    _pMChapterStage: 3500,
    _pMFirstAudience: Object.assign(audienceDefaults(), { page: 'assessment-question', identityResponse: 'accept' }),
  })
  PMEnslavementSystem.open()
  await click(0)
  assert.equal(state._pMFirstAudience.assessmentVariant, 'experienced')
  assert(currentScene.body.includes('更适合当性奴'))
  assert(currentScene.body.includes('妓院'))
  assert(!currentScene.body.includes('劳役还是性奴'))

  reset({
    gender: 'female',
    _pMChapterBranch: 'novice',
    _pMChapterStage: 3500,
    _pMFirstAudience: Object.assign(audienceDefaults(), { page: 'assessment-question', identityResponse: 'object' }),
  })
  PMEnslavementSystem.open()
  await click(0)
  assert.equal(state._pMFirstAudience.assessmentVariant, 'guarded')
  assert(currentScene.body.includes('谈条件'))
  assert(currentScene.body.includes('压价格'))
  assert(!currentScene.body.includes('妓院'))
  assert(!currentScene.body.includes('更适合当性奴'))

  reset({
    gender: 'male',
    _pMChapterStage: 3000,
    _pMChapterBranch: 'novice',
    _pMFirstAudience: audienceDefaults(),
  })
  PMEnslavementSystem.open()
  await fromIdentityTo4000(['口部验收', '正面验收', '菊穴验收'])
  assert(currentScene.title.includes('派克的命令'))
  PMEnslavementSystem.open()
  assert.equal(state._pMChapterStage, 4000)
  currentScene.actions.find(action => action.label === '“是，奴隶主。”').handler()
  assert.equal(state._pMChapterStage, 9500)

  reset({
    gender: 'male',
    _pMChapterStage: 3500,
    _pMChapterBranch: 'novice',
    _pMFirstAudience: Object.assign(audienceDefaults(), { page: 'assessment-question', identityResponse: 'accept' }),
  })
  PMEnslavementSystem.open()
  await click(0)
  assert.equal(state._pMFirstAudience.assessmentVariant, 'novice')
  assert(currentScene.body.includes('腰胯结实'))
  assert(currentScene.body.includes('劳役还是性奴'))
  assert(!currentScene.body.includes('胸'))
  assert(!currentScene.body.includes('小穴'))
  assert(!currentScene.body.includes('湿得快'))

  reset({
    gender: 'female',
    _pMChapterStage: 3500,
    _pMChapterBranch: 'novice',
    _pMFirstAudience: Object.assign(audienceDefaults(), { page: 'assessment-question', identityResponse: 'accept' }),
  })
  PMEnslavementSystem.open()
  await click(0)
  const firstBody = currentScene.body
  assert.equal(state._pMFirstAudience.assessmentVariant, 'novice')
  state._pMChapterBranch = 'experienced'
  PMEnslavementSystem.open()
  assert.equal(state._pMFirstAudience.assessmentVariant, 'novice')
  assert.equal(currentScene.body, firstBody)

  reset({
    _pMChapterCompleted: true,
    _pMChapterStage: 9500,
    _pMFirstAudience: Object.assign(audienceDefaults(), { commandConfirmed: true, page: 'chapter-complete' }),
    _pCatchingIvana: { version: 1, stage: 0, page: 'objective', started: true, completed: false },
  })
  PMEnslavementSystem.open()
  assert.equal(campOpened, 1)
  assert.equal(state._pMChapterStage, 9500)
  assert.equal(state._pMChapterCompleted, true)

  reset({
    _pMChapterCompleted: true,
    _pMChapterStage: 9500,
    _pMainlineStage: 6,
    _pCatchingIvana: { version: 1, stage: 0, page: 'objective', started: true, completed: false },
  })
  PCatchingIvanaSystem.open()
  assert.equal(currentScene.title, '📜 奴隶线后续任务 · 捕获伊凡娜')
  assert(currentScene.body.includes('返回城门'))
  await click(0)
  assert.equal(state._pCatchingIvana.page, 'gate')
  assert.equal(currentScene.title, '⛓️ 城门 · 登记桌')
  await click(0)
  assert.equal(state._pCatchingIvana.page, 'bellamy-ask')
  await click(0)
  assert.equal(state._pCatchingIvana.bellamyAnswer, 'obey')
  assert.equal(state._pCatchingIvana.page, 'bellamy-reply')
  await click(0)
  assert.equal(state._pCatchingIvana.page, 'bellamy-done')
  assert.equal(state._pCatchingIvana.stage, 0)
  PCatchingIvanaSystem.open()
  assert(currentScene.body.includes('尚未开放'))

  console.log('m-stage-3000-9500-ok')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
