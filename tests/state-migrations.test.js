const fs = require('fs')
const assert = require('assert')

global.window = global
global.document = { addEventListener: () => {}, visibilityState: 'visible' }
window.addEventListener = () => {}
global.EventBus = { emit: () => {}, on: () => {} }
global.CONFIG = { difficulty: { normal: { maxHp: 25 } }, map: { start: { x: 0, y: 0 } }, save: { autoSave: false } }
global.MAP_GRID = [[0]]
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
global.ItemLib = { weapon: () => null, accessory: () => null }
global.RESTRAINTS = []
global.TELEPORTS = [{ id: 'camp' }]

for (const file of ['js/state-schema.js', 'js/state-migrations.js', 'js/state.js']) {
  ;(0, eval)(fs.readFileSync(file, 'utf8'))
}

const fresh = State.init('normal')
const legacy = JSON.parse(JSON.stringify(fresh))
legacy.saveVersion = 2
legacy._wrongCommissionStage = 4
legacy._tavernGuest = 9
legacy._townReputation = { score: 22, fame: 11, history: [], counters: {}, seeded: true }
delete legacy.systems.pStory
delete legacy.systems.tavern
delete legacy.systems.townReputation

const migrated = State.migrate(legacy)
assert.equal(migrated.saveVersion, 3)
assert.equal(migrated._wrongCommissionStage, 4)
assert.equal(migrated._tavernGuest, 9)
assert.equal(migrated._townReputation.score, 22)
assert.deepEqual(StateMigrations.stages, [
  'migrateCore', 'migrateRestraints', 'migrateTown',
  'migrateTavern', 'migrateBattle', 'migrateEquipment',
])

const once = JSON.stringify(migrated)
State.migrate(migrated)
assert.equal(JSON.stringify(migrated), once, '迁移流水线必须保持幂等')

console.log('state-migrations-ok')
