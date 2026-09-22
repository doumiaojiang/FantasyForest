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

const oldChapter = JSON.parse(JSON.stringify(fresh))
oldChapter.systems.pStory.revision = 2
oldChapter.systems.pStory.mainlineStage = 6
oldChapter.systems.pStory.role = 'slaver'
oldChapter.systems.pStory.chapterOneLocked = false
oldChapter.systems.pStory.routeLocked = true
oldChapter.systems.pStory.dayaOutcome = 'slaver_training'
oldChapter.systems.pStory.commissionStage = 10
const rewoundChapter = State.migrate(oldChapter)
assert.equal(rewoundChapter._pStoryRevision, 3)
assert.equal(rewoundChapter._pMainlineStage, 1)
assert.equal(rewoundChapter._pRole, null)
assert.equal(rewoundChapter._pChapterOneLocked, false)
assert.equal(rewoundChapter._pRouteLocked, false)
assert.equal(rewoundChapter._pDayaOutcome, null)

const currentChoice = JSON.parse(JSON.stringify(fresh))
currentChoice.systems.pStory.revision = 2
currentChoice.systems.pStory.mainlineStage = 2
currentChoice.systems.pStory.role = 'slave'
currentChoice.systems.pStory.chapterOneLocked = true
currentChoice.systems.pStory.commissionStage = 10
const preservedChoice = State.migrate(currentChoice)
assert.equal(preservedChoice._pMainlineStage, 2)
assert.equal(preservedChoice._pRole, 'slave')
assert.equal(preservedChoice._pChapterOneLocked, true)

const malformedMChapter = JSON.parse(JSON.stringify(fresh))
malformedMChapter.systems.pStory.mChapterStage = 777
malformedMChapter.systems.pStory.mChapterStep = 99
malformedMChapter.systems.pStory.mChapterBranch = 'unknown'
malformedMChapter.systems.pStory.mChapterAttitude = 'unknown'
malformedMChapter.systems.pStory.mChapterFailures = -8
malformedMChapter.systems.pStory.mChapterEscrow = { weapon: 123, accessories: ['ring', 'seal'] }
malformedMChapter.systems.pStory.mConfiscated = 1
malformedMChapter.systems.pStory.mConfiscationEscrow = []
malformedMChapter.systems.pStory.mChapterRestraintEscrow = []
malformedMChapter.systems.pStory.mGroomed = 1
malformedMChapter.systems.pStory.mBranded = 1
malformedMChapter.systems.pStory.mSisterBond = 1
malformedMChapter.systems.pStory.mMarketResponse = 'unknown'
malformedMChapter.systems.pStory.mDayaChoice = 'unknown'
const normalizedMChapter = State.migrate(malformedMChapter)
assert.equal(normalizedMChapter._pMChapterStage, 0)
assert.equal(normalizedMChapter._pMChapterStep, 8)
assert.equal(normalizedMChapter._pMChapterBranch, null)
assert.equal(normalizedMChapter._pMChapterAttitude, null)
assert.equal(normalizedMChapter._pMChapterFailures, 0)
assert.equal(normalizedMChapter._pMChapterEscrow.weapon, '123')
assert.deepEqual(normalizedMChapter._pMChapterEscrow.accessories, ['ring', 'seal'])
assert.equal(normalizedMChapter._pMConfiscated, true)
assert.equal(normalizedMChapter._pMConfiscationEscrow, null)
assert.equal(normalizedMChapter._pMChapterRestraintEscrow, null)
assert.equal(normalizedMChapter._pMGroomed, true)
assert.equal(normalizedMChapter._pMBranded, true)
assert.equal(normalizedMChapter._pMSisterBond, true)
assert.equal(normalizedMChapter._pMMarketResponse, null)
assert.equal(normalizedMChapter._pMDayaChoice, null)

const stage2500Save = JSON.parse(JSON.stringify(fresh))
stage2500Save.systems.pStory.mChapterStage = 2500
stage2500Save.systems.pStory.mChapterStep = 1
const preserved2500 = State.migrate(stage2500Save)
assert.equal(preserved2500._pMChapterStage, 2500, '2500 阶段读档不得回退到章节开头')
assert.equal(preserved2500._pMChapterStep, 1)

console.log('state-migrations-ok')
