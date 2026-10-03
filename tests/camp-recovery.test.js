const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function boot(initial = {}) {
  const state = { gender: 'male', difficulty: 'normal', gold: 1000, hp: 25,
    inventory: { consumables: {} }, _inPrison: true, _prisonPoints: 0, ...initial }
  let scene, saves = [], rolls = 0, tasks = 0
  const controls = new Map()
  const context = {
    console, State: { get: () => state, save: () => { saves.push(JSON.parse(JSON.stringify(state))); return true } },
    CampSystem: { gloryFee: 30, showScene: s => { scene = s }, open() {}, townPrice: p => p },
    EventBus: { emit() {} }, StatusSystem: { has: () => false, apply() {}, remove() {} },
    RESTRAINTS: [], Math, Dice: { rollZ: () => { rolls++; return 2 } },
    Dialog: { close() {}, show: s => { scene = s }, showDice: async () => {} },
    BattleUI: { showTaskDialog: async () => { tasks++; return false } },
    document: { querySelectorAll: selector => {
      const attr = selector.slice(1, -1)
      const buttons = []
      for (const m of (scene?.body || '').matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) {
        const key = attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const button = { dataset: { [key]: m[1] } }
        controls.set(`${attr}:${m[1]}`, button); buttons.push(button)
      }
      return buttons
    }, querySelector: () => null },
  }
  context.window = context
  vm.createContext(context)
  for (const file of ['camp-prison.js', 'camp-tavern-patrons.js']) {
    vm.runInContext(fs.readFileSync(`js/systems/${file}`, 'utf8'), context)
  }
  return { context, state, controls, scene: () => scene, saves: () => saves,
    tasks: () => tasks, rolls: () => rolls }
}

async function run() {
  const menu = boot({ _prisonPoints: 80, _prisonPending: { mode: 'tier' } })
  menu.context.TownPrisonSystem.resume()
  assert.match(menu.scene().title, /名册/)
  assert.ok(menu.controls.has('data-tier:mid'))
  assert.equal(menu.state._prisonPoints, 80)
  menu.context.TownPrisonSystem.enter()
  assert.equal(menu.state._prisonPoints, 80, 'Repeated entry must not reset earned points')

  const task = boot({ _prisonPending: { mode: 'task', tier: 'basic', roll: 2, stepIndex: 0 } })
  await task.context.TownPrisonSystem.resume()
  assert.equal(task.rolls(), 0, 'Restoring an assigned task must not reroll')
  assert.equal(task.tasks(), 1)
  assert.equal(task.state._prisonPoints, 4)
  assert.equal(task.state._prisonPending, null)
  assert.ok(task.saves().some(s => s._prisonPending?.stepIndex === 1))
  await task.context.TownPrisonSystem.resume()
  assert.equal(task.state._prisonPoints, 4, 'Settled task must not pay twice')

  const complete = boot({ _prisonPoints: 296, _prisonPending: { mode: 'task', tier: 'basic', roll: 2, stepIndex: 1 } })
  await complete.context.TownPrisonSystem.resume()
  assert.equal(complete.tasks(), 0, 'A completed checkpoint only settles')
  assert.equal(complete.state._prisonPoints, 300)
  complete.controls.get('data-prison-action:release').onclick()
  assert.equal(complete.state._inPrison, false)
  assert.equal(complete.state._prisonPoints, 0)
  assert.equal(complete.saves().at(-1)._inPrison, false)
  for (const gender of ['male', 'female']) {
    for (const [difficulty, target] of [['normal', 300], ['hard', 400], ['brutal', 500]]) {
      const t = boot({ gender, difficulty, _prisonPoints: target })
      t.context.TownPrisonSystem.resume()
      assert.ok(t.controls.has('data-prison-action:release'))
      t.controls.get('data-prison-action:release').onclick()
      assert.equal(t.state._inPrison, false)
      assert.equal(t.state._prisonPending, null)
    }
  }
  const failed = boot({ _prisonPending: { mode: 'task', tier: 'basic', roll: 2, stepIndex: 0 } })
  failed.context.BattleUI.showTaskDialog = async () => true
  await failed.context.TownPrisonSystem.resume()
  assert.equal(failed.state._prisonPoints, 0)
  assert.equal(failed.state._prisonPending, null)

  const partial = boot({ _prisonPending: { mode: 'task', tier: 'adv', roll: 3, stepIndex: 2 } })
  await partial.context.TownPrisonSystem.resume()
  assert.equal(partial.tasks(), 0)
  assert.equal(partial.state._prisonPoints, 30)

  for (const [mode, title] of [['punishment', '矫正教育'], ['adv-punishment', '纯虐待'], ['escape', '换岗']]) {
    const t = boot({ _prisonPending: { mode, roll: 0 } })
    t.context.TownPrisonSystem.resume()
    assert.match(t.scene().title, new RegExp(title))
    assert.equal(t.state._prisonPending.mode, mode)
  }
  for (const mode of ['punishment', 'adv-punishment']) {
    const t = boot({ _prisonPending: { mode, roll: 3, stepIndex: mode === 'punishment' ? 1 : 3 } })
    await t.context.TownPrisonSystem.resume()
    assert.equal(t.rolls(), 0)
    assert.equal(t.tasks(), 0)
    assert.equal(t.state._prisonPoints, 0)
    assert.equal(t.state._prisonPending.roll, 0)
  }

  const shop = boot({ _dreamShopCategory: 'tools' })
  shop.context.TownTavernPatronsSystem.openDreamShop()
  assert.equal(shop.state.phase, 'shop')
  assert.equal(shop.state._activeShopRaw, 'dream')
  assert.match(shop.scene().body, /data-shop-cat="tools" aria-current="true"/)
  shop.controls.get('data-shop-cat:sensory').onclick()
  assert.equal(shop.state._dreamShopCategory, 'sensory')
  shop.scene().actions[0].handler()
  assert.equal(shop.state.phase, 'camp')
  assert.equal(shop.state._activeShopRaw, null)
  assert.equal(shop.saves().at(-1).phase, 'camp')
  let changelogShows = 0
  shop.context.document.getElementById = () => ({ classList: { contains: () => true } })
  shop.context.Dialog.show = () => { changelogShows++ }
  vm.runInContext(fs.readFileSync('js/ui/changelog.js', 'utf8'), shop.context)
  shop.context.Changelog.check()
  assert.equal(changelogShows, 0, 'Startup changelog must not replace restored gameplay dialogs')
  console.log('camp-recovery-ok')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
