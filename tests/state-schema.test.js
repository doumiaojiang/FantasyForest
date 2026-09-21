const fs = require('fs')
const assert = require('assert')

global.window = global
;(0, eval)(fs.readFileSync('js/state-schema.js', 'utf8'))

const legacy = {
  saveVersion: 2,
  _gloryDebt: 75,
  _glorySettings: { footService: false },
  _inPrison: true,
  _prisonPoints: 180,
  _tavernGuest: 17,
  _tavernWorkUnlocked: true,
  _prostituteLicensed: true,
  _prostituteLevel: 34,
  _prostitutePendingTask: { customerKey: 'orc', z: 4, stepIndex: 2 },
  _mercenary: { id: 'futa_warrior', name: '芙蕾雅', dmg: 2 },
  _mercenaryContract: { debt: 120, active: null },
  _restraints: { neck: { id: 'iron_collar', slot: 'neck', locked: true } },
  _ownedRestraints: ['iron_collar'],
  _ownedRestraintCounts: { vibration_egg: 2 },
  _insertionCharges: { vagina: 3 },
  _storedInsertionCharges: { vibration_egg: [{ charge: 2, count: 1 }] },
  _restraintContract: { id: 'locked_journey', progress: 1 },
  _restraintContractOffers: ['locked_journey'],
  _restraintContractCompleted: 2,
  _wanted: true,
  _teleports: ['camp', 'old_bridge'],
  _guardSearchSettings: { enabled: true, frequency: 'high' },
  _pillory: { source: 'voluntary', duration: 30, stage: 'restraint' },
  _townReputation: { score: 12, fame: 8, history: [], counters: {}, seeded: true },
  _campDeerTaken: true,
}

StateSchema.prepare(legacy)
assert.equal(legacy.systems.glory.debt, 75)
assert.equal(legacy.systems.glory.settings.footService, false)
assert.equal(legacy.systems.prison.active, true)
assert.equal(legacy.systems.prison.points, 180)
assert.equal(legacy.systems.tavern.guestGold, 17)
assert.equal(legacy.systems.tavern.workUnlocked, true)
assert.equal(legacy.systems.prostitute.licensed, true)
assert.equal(legacy.systems.prostitute.level, 34)
assert.deepEqual(legacy.systems.prostitute.pendingTask, { customerKey: 'orc', z: 4, stepIndex: 2 })
assert.equal(legacy.systems.mercenary.member.name, '芙蕾雅')
assert.equal(legacy.systems.mercenary.contract.debt, 120)
assert.equal(legacy.systems.restraints.worn.neck.id, 'iron_collar')
assert.deepEqual(legacy.systems.restraints.owned, ['iron_collar'])
assert.equal(legacy.systems.restraints.insertionCharges.vagina, 3)
assert.equal(legacy.systems.restraintContract.active.id, 'locked_journey')
assert.equal(legacy.systems.restraintContract.completed, 2)
assert.equal(legacy.systems.town.wanted, true)
assert.deepEqual(legacy.systems.town.teleports, ['camp', 'old_bridge'])
assert.equal(legacy.systems.guard.settings.frequency, 'high')
assert.equal(legacy.systems.pillory.active.duration, 30)
assert.equal(legacy.systems.townReputation.value.score, 12)

legacy._gloryDebt = 40
legacy.systems.prison.points = 220
assert.equal(legacy.systems.glory.debt, 40)
assert.equal(legacy._prisonPoints, 220)

const serialized = JSON.stringify(legacy)
assert(!serialized.includes('_gloryDebt'))
assert(!serialized.includes('_prisonPoints'))
assert(!serialized.includes('_prostituteLevel'))
assert(!serialized.includes('_mercenaryContract'))
assert(!serialized.includes('_restraints'))
assert(!serialized.includes('_restraintContract'))
assert(!serialized.includes('_townReputation'))
assert(!serialized.includes('_guardSearchSettings'))
assert(serialized.includes('"systems"'))

const roundTrip = JSON.parse(serialized)
StateSchema.prepare(roundTrip)
assert.equal(roundTrip._gloryDebt, 40)
assert.equal(roundTrip._prisonPoints, 220)
assert.equal(roundTrip._tavernGuest, 17)
assert.equal(roundTrip._prostituteLevel, 34)
assert.equal(roundTrip._mercenaryContract.debt, 120)
assert.equal(roundTrip._restraints.neck.id, 'iron_collar')
assert.equal(roundTrip._restraintContractCompleted, 2)
assert.equal(roundTrip._wanted, true)
assert.equal(roundTrip._townReputation.score, 12)

StateSchema.prepare(roundTrip)
assert.equal(roundTrip._gloryDebt, 40, '重复迁移必须保持幂等')
assert.equal(roundTrip._prisonPoints, 220, '重复迁移不能重置领域数据')
assert.equal(roundTrip._prostituteLevel, 34, '重复迁移不能重置接客等级')
assert.equal(roundTrip._restraints.neck.id, 'iron_collar', '重复迁移不能丢失穿戴装备')
assert.equal(roundTrip._townReputation.score, 12, '重复迁移不能重置城镇声望')

console.log('state-schema-ok')
