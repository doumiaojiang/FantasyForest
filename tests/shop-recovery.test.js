const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
function boot(previous) {
  const state = previous || { gender: 'male', difficulty: 'normal', phase: 'camp', gold: 1000,
    position: { x: 13, y: 9 }, inventory: { consumables: {}, accessories: [] }, ownedEquipment: [] }
  const potion = { id: 'potion', type: 'consumable', price: 80 }
  let saved, camp = 0
  const context = { console, State: { get: () => state, save: () => { saved = JSON.parse(JSON.stringify(state)); return true } },
    ITEMS: { consumables: [potion] }, ItemLib: { get: () => potion }, EventBus: { emit() {} },
    TILE: { CAMP: 1, SHOP: 2 }, MapLib: { get: () => ({ type: 1, raw: '营地' }) },
    CampSystem: { open: () => { camp++ } }, GameFlow: { afterEvent() {} },
  }
  context.window = context
  vm.createContext(context)
  vm.runInContext(fs.readFileSync('js/systems/shop.js', 'utf8'), context)
  return { state, system: context.ShopSystem, saved: () => saved, camp: () => camp }
}
const initial = boot()
initial.system.open({ type: 1, raw: '道具商' })
assert.equal(initial.system.buy('potion').ok, true)
const restored = boot(initial.saved())
restored.system.open(null)
assert.equal(restored.system.getStock().potion, 1)
assert.equal(restored.state.gold, 920)
assert.equal(restored.state.inventory.consumables.potion, 1)
restored.system.buy('potion')
const soldOut = boot(restored.saved())
soldOut.system.open(null)
assert.equal(soldOut.system.getStock().potion, 0)
assert.equal(soldOut.system.buy('potion').ok, false)
assert.equal(soldOut.state.gold, 840)
soldOut.system.close()
assert.equal(soldOut.saved().phase, 'camp')
assert.equal(soldOut.saved()._shopStock, null)
assert.equal(soldOut.camp(), 1)
soldOut.system.open({ type: 1, raw: '道具商' })
assert.equal(soldOut.system.getStock().potion, 2, 'A new visit retains the existing restock rule')
console.log('shop-recovery-ok')
