const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

// Execute production callbacks with an isolated state; never touch player saves.
function boot(naked, debt = 0) {
  const state = { gold: 500, gender: 'male', difficulty: 'normal', _prostituteLicensed: true,
    _prostituteDressed: true, _prostituteLevel: 1, _prostituteDebt: debt,
    _tavernWorkUnlocked: true, inventory: { consumables: {} } }
  let scene, saves = 0, campVisits = 0, tasks = 0
  const checkpoints = []
  const controls = new Map()
  const context = {
    console, Math, State: { get: () => state, save: () => {
      saves++; checkpoints.push(state._prostitutePendingTask && { ...state._prostitutePendingTask })
    } },
    CampSystem: { gloryFee: 30, showScene: s => { scene = s },
      open: () => { campVisits++ }, ensurePhase() {}, townPrice: p => p },
    TownGlorySystem: { lockedServiceGear: () => [], showServiceGearLockout: () => false },
    StatusSystem: { has: id => id === 'naked' && naked },
    EventBus: { emit() {} }, Dialog: { close() {}, showDice: async () => {} },
    ChastitySystem: { isWorn: () => false },
    CONFIG: { difficulty: { normal: { campTax: 0 } } },
    Dice: { rollZ: () => 1 }, BattleUI: { showTaskDialog: async () => { tasks++; return false } },
    document: { querySelectorAll: () => [], querySelector: selector => {
      const control = {}; controls.set(selector, control); return control
    } },
  }
  context.window = context
  vm.createContext(context)
  for (const file of ['camp-tavern.js', 'camp-tavern-patrons.js', 'camp-tavern-work.js']) {
    vm.runInContext(fs.readFileSync(`js/systems/${file}`, 'utf8'), context)
  }
  return { context, state, controls, checkpoints, tasks: () => tasks, scene: () => scene, saves: () => saves, campVisits: () => campVisits }
}
function click(test, text) {
  const action = test.scene().actions.find(a => a.label.includes(text))
  assert.ok(action, `Missing action: ${text}`)
  return action.handler()
}
async function run() {
  for (const naked of [false, true]) {
    const t = boot(naked)
    t.context.TownTavernWorkSystem.open()
    t.controls.get('[data-work="prostitute"]').onclick()
    click(t, '结束营业')
    assert.equal(t.state._prostituteDressed, false)
    assert.ok(t.saves() > 0)
    click(t, '返回酒馆')
    click(t, '返回营地')
    assert.equal(t.campVisits(), 1)

    t.state._prostituteDressed = true
    await t.context.TownTavernWorkSystem.resumeCustomerTask('guard', 1, 0)
    assert.equal(t.state._prostitutePendingTask, null)
    click(t, '结束营业')
    assert.equal(t.state._prostituteDressed, false)
  }
  const debtor = boot(true, 100)
  debtor.context.TownTavernWorkSystem.open()
  debtor.controls.get('[data-work="prostitute"]').onclick()
  assert.ok(!debtor.scene().actions.some(a => a.label.includes('结束营业')))
  const checkpoint = boot(false)
  await checkpoint.context.TownTavernWorkSystem.resumeCustomerTask('goblin', 1, 0)
  assert.equal(checkpoint.tasks(), 2)
  assert.deepEqual(checkpoint.checkpoints.filter(Boolean).map(p => p.stepIndex), [0, 1, 2])
  const resumed = boot(false)
  await resumed.context.TownTavernWorkSystem.resumeCustomerTask('goblin', 1, 2)
  assert.equal(resumed.tasks(), 0, 'A fully completed checkpoint must settle without replaying the last step')
  assert.equal(resumed.state._prostitutePendingTask, null)
  console.log('tavern-navigation-ok')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
