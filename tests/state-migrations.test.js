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
legacy._pBanditDefeatScene = 14
legacy._pBanditVictoryResult = { fleeingCrew: 1, clothesTaken: true, gold: 22 }
legacy._pBanditAftermath = 'witness-trade'
legacy._pBanditToySession = { days: 3, uses: [{ actor: 'a', name: 'n', desc: 'd' }], index: 1, repeat: false, announcedDay: 2 }
legacy._pBanditTradeStep = 4
legacy._pCaravanEscortStage = 1
legacy._pCaravanEscortResult = { goldLost: 12, provoked: true, bindings: 4, naked: true, punished: true, punishmentStep: 2, gateUsed: true }
legacy._pDefeatDispatchPending = true
legacy._pDefeatPunished = true
legacy._pDefeatSentenced = true
legacy._pDefeatPunishmentStep = 2
legacy._tavernGuest = 9
legacy._townReputation = { score: 22, fame: 11, history: [], counters: {}, seeded: true }
delete legacy.systems.pStory
delete legacy.systems.tavern
delete legacy.systems.townReputation

const migrated = State.migrate(legacy)
assert.equal(migrated.saveVersion, 3)
assert.equal(migrated._wrongCommissionStage, 4)
assert.equal(migrated._pBanditDefeatScene, 14)
assert.equal(migrated._pBanditVictoryResult.gold, 22)
assert.equal(migrated._pBanditAftermath, 'witness-trade')
assert.equal(migrated._pBanditToySession.announcedDay, 2)
assert.equal(migrated._pBanditTradeStep, 4)
assert.equal(migrated._pCaravanEscortResult.punished, true)
assert.equal(migrated._pCaravanEscortResult.punishmentStep, 2)
assert.equal(migrated._pCaravanEscortResult.gateUsed, true)
assert.equal(migrated._pDefeatPunished, true)
assert.equal(migrated._pDefeatSentenced, true)
assert.equal(migrated._pDefeatPunishmentStep, 2)
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
