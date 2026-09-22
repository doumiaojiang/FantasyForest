#!/usr/bin/env node

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const context = { window: {} }
vm.createContext(context)
vm.runInContext(read('js/data/monsters.js'), context)

const boss = context.window.MONSTERS.find(monster => monster.id === 'p_bandit_leader')
assert.ok(boss)
assert.equal(boss.maxHp, 9)
assert.deepEqual(Array.from(boss.props.banditCrew, member => member.hp), [3, 3])
assert.equal(boss.abilities.charge.interruptDamage, 3)
assert.equal(boss.attacks.find(attack => attack.roll === 3).requiresCrew, 'bandit-lookout')
assert.equal(boss.attacks.find(attack => attack.roll === 3).secondaryPart, 'oral')
assert.deepEqual(Array.from(boss.attacks.find(attack => attack.roll === 4).taskSequence, step => step.count), [15, 5])
assert.ok(boss.attacks.find(attack => attack.roll === 2).repeat)

const battle = read('js/systems/battle.js')
assert.match(battle, /banditCoverUsed/)
assert.match(battle, /banditClothesTaken/)
const ui = read('js/ui/battle.js')
assert.match(ui, /p_bandit_cutpurse/)
const story = read('js/systems/commission.js')
assert.match(story, /function recoverBanditClothes/)
assert.match(story, /playBanditToyDefeat/)

console.log('bandit leader tests passed')
