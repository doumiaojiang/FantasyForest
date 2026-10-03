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

const stage2500Save = JSON.parse(JSON.stringify(fresh))
stage2500Save.systems.pStory.mChapterStage = 2500
stage2500Save.systems.pStory.mChapterStep = 1
const preserved2500 = State.migrate(stage2500Save)
assert.equal(preserved2500._pMChapterStage, 2500, '2500 阶段读档不得回退到章节开头')
assert.equal(preserved2500._pMChapterStep, 1)

const legacyStage3000TaskDone = JSON.parse(JSON.stringify(fresh))
legacyStage3000TaskDone.systems.pStory.mChapterStage = 3000
legacyStage3000TaskDone.systems.pStory.mChapterStep = 3
delete legacyStage3000TaskDone.systems.pStory.mFirstAudience
const migratedStage3500 = State.migrate(legacyStage3000TaskDone)
assert.equal(migratedStage3500._pMChapterStage, 3500, '旧3000检查完成存档应进入评估阶段')
assert.equal(migratedStage3500._pMChapterStep, 0)
assert.equal(migratedStage3500._pMFirstAudience.page, 'assessment-question')

for (const legacyStage of [4000, 9500]) {
  const save = JSON.parse(JSON.stringify(fresh))
  save.systems.pStory.mChapterStage = legacyStage
  save.systems.pStory.mChapterStep = 6
  delete save.systems.pStory.mFirstAudience
  const restored = State.migrate(save)
  assert.equal(restored._pMChapterStage, 4000, `旧${legacyStage}存档应回到新命令阶段`)
  assert.equal(restored._pMChapterStep, 0)
  assert.equal(restored._pMFirstAudience.assessmentViewed, true)
  assert.equal(restored._pMChapterCompleted, false)
}

const confirmedStage4000 = JSON.parse(JSON.stringify(fresh))
confirmedStage4000.systems.pStory.role = 'slave'
confirmedStage4000.systems.pStory.mainlineStage = 2
confirmedStage4000.systems.pStory.mChapterStage = 4000
confirmedStage4000.systems.pStory.mFirstAudience = {
  version: 1, page: 'chapter-complete', arrivalResponse: 'obey', identityResponse: 'accept', assessmentVariant: 'novice',
  assessmentViewed: true, commandReasonAsked: false, commandObjected: false,
  commandPunishmentCompleted: false, removedGear: [], commandConfirmed: true,
}
const migratedConfirmed4000 = State.migrate(confirmedStage4000)
assert.equal(migratedConfirmed4000._pMChapterStage, 9500, '已确认命令的4000存档应完成第一章')
assert.equal(migratedConfirmed4000._pMChapterCompleted, true)
assert.equal(migratedConfirmed4000._pMainlineStage, 6)
assert.equal(migratedConfirmed4000._pCatchingIvana.stage, 0)
assert.equal(migratedConfirmed4000._pCatchingIvana.page, 'objective')
assert.equal(migratedConfirmed4000._pCatchingIvana.started, true)
assert.equal(migratedConfirmed4000._pCatchingIvana.bellamyAnswer, null)

const oldIncomplete9500WithAudience = JSON.parse(JSON.stringify(fresh))
oldIncomplete9500WithAudience.systems.pStory.role = 'slave'
oldIncomplete9500WithAudience.systems.pStory.mChapterStage = 9500
oldIncomplete9500WithAudience.systems.pStory.mFirstAudience = JSON.parse(JSON.stringify(confirmedStage4000.systems.pStory.mFirstAudience))
const restoredIncomplete9500 = State.migrate(oldIncomplete9500WithAudience)
assert.equal(restoredIncomplete9500._pMChapterStage, 4000, '未完成的旧9500存档必须返回命令页')
assert.equal(restoredIncomplete9500._pMChapterCompleted, false)
assert.equal(restoredIncomplete9500._pMFirstAudience.commandConfirmed, false)
assert.equal(restoredIncomplete9500._pCatchingIvana, null)

const oldCompleted10000 = JSON.parse(JSON.stringify(fresh))
oldCompleted10000.systems.pStory.role = 'slave'
oldCompleted10000.systems.pStory.mainlineStage = 6
oldCompleted10000.systems.pStory.mChapterStage = 10000
oldCompleted10000.systems.pStory.mChapterCompleted = true
delete oldCompleted10000.systems.pStory.catchingIvana
const migratedCompleted10000 = State.migrate(oldCompleted10000)
assert.equal(migratedCompleted10000._pMChapterStage, 9500, '旧10000完成档应统一映射到9500')
assert.equal(migratedCompleted10000._pMChapterCompleted, true)
assert.equal(migratedCompleted10000._pCatchingIvana.stage, 0)
assert.equal(migratedCompleted10000._pCatchingIvana.started, true)
assert.equal(migratedCompleted10000._pCatchingIvana.page, 'objective')

const catchingPages = JSON.parse(JSON.stringify(fresh))
catchingPages.systems.pStory.role = 'slave'
catchingPages.systems.pStory.mChapterCompleted = true
catchingPages.systems.pStory.catchingIvana = { version: 1, stage: 9, page: 'saved-page', bellamyAnswer: 'yell', started: true, completed: false }
const normalizedCatching = State.migrate(catchingPages)._pCatchingIvana
assert.equal(normalizedCatching.stage, 0, '未实现的捕获伊凡娜阶段必须停在 0')
assert.equal(normalizedCatching.page, 'objective')
assert.equal(normalizedCatching.bellamyAnswer, null)

const catchingHandoff = JSON.parse(JSON.stringify(fresh))
catchingHandoff.systems.pStory.role = 'slave'
catchingHandoff.systems.pStory.mChapterCompleted = true
catchingHandoff.systems.pStory.catchingIvana = { version: 1, stage: 0, page: 'bellamy-done', bellamyAnswer: 'obey', started: true, completed: false }
assert.equal(State.migrate(catchingHandoff)._pCatchingIvana.page, 'bellamy-done', '已送达的口信页必须保留')

const malformedAudience = JSON.parse(JSON.stringify(fresh))
malformedAudience.systems.pStory.mChapterStage = 4000
malformedAudience.systems.pStory.mFirstAudience = { version: 99, page: 3, arrivalResponse: 'bad', identityResponse: 'bad', assessmentVariant: 'bad', removedGear: ['mouth', 'arms', 'mouth'], commandConfirmed: 1 }
const normalizedAudience = State.migrate(malformedAudience)._pMFirstAudience
assert.equal(normalizedAudience.version, 1)
assert.equal(normalizedAudience.arrivalResponse, null)
assert.equal(normalizedAudience.identityResponse, null)
assert.equal(normalizedAudience.assessmentVariant, null)
assert.deepEqual(normalizedAudience.removedGear, ['mouth'])
assert.equal(normalizedAudience.commandPunishmentCompleted, false)
assert.equal(normalizedAudience.commandConfirmed, true)

for (const poseId of ['classic', 'nude_bent', 'nude_kneel']) {
  const save = JSON.parse(JSON.stringify(fresh))
  save.systems.pillory.active = { poseId, duration: 30, stage: 'restraint', crowdLine: '测试围观记录' }
  const restored = State.migrate(save)
  assert.equal(restored._pillory.poseId, poseId, '木枷读档必须保留所选姿势')
  assert.equal(restored._pillory.crowdLine, '测试围观记录')
}
const completedEvent = JSON.parse(JSON.stringify(fresh))
completedEvent.systems.pillory.active = { stage: 'adult', poseId: 'classic', duration: 30,
  event: { id: 'cruel_guard_trial', part: 'spank', storyChoice: 'endure', storyStage: 'complete',
    bonus: 10, applied: true, consequencesApplied: true } }
const restoredEvent = State.migrate(completedEvent)._pillory.event
assert.equal(restoredEvent.storyChoice, 'endure')
assert.equal(restoredEvent.storyStage, 'complete')
assert.equal(restoredEvent.bonus, 10)
assert.equal(restoredEvent.consequencesApplied, true)

const prisonSave = JSON.parse(JSON.stringify(fresh))
prisonSave.systems.prison.active = true
prisonSave.systems.prison.pending = { mode: 'task', tier: 'adv', roll: 2, stepIndex: 1, restPending: true }
prisonSave._dreamShopCategory = 'sensory'
const restoredPrison = State.migrate(prisonSave)
assert.deepEqual(restoredPrison._prisonPending, { mode: 'task', tier: 'adv', roll: 2, stepIndex: 1, restPending: true })
assert.equal(restoredPrison._dreamShopCategory, 'sensory')
restoredPrison._inPrison = false
State.migrate(restoredPrison)
assert.equal(restoredPrison._prisonPending, null, 'Released saves must discard stale prison checkpoints')

console.log('state-migrations-ok')
