#!/usr/bin/env node

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')

const context = { window: {} }
vm.createContext(context)
vm.runInContext(source('js/data/monsters.js'), context)

const guard = context.window.MONSTERS.find(monster => monster.id === 'p_caravan_guard')
assert.ok(guard, 'P caravan guard must exist')

const attacks = new Map(guard.attacks.map(attack => [attack.roll, attack]))
assert.equal(attacks.get(1).inspectionPart, 'anal', 'search must declare an inspection target')
assert.equal(attacks.get(3).part, 'oral', 'gag checks must not depend on prose keywords')
assert.equal(attacks.get(3).provoked.part, 'oral', 'provoked oral attack must keep explicit part')
assert.equal(attacks.get(4).part, 'anal', 'rear attack must declare its target')
assert.equal(attacks.get(4).provoked.part, 'anal', 'provoked rear attack must declare its target')
assert.ok(attacks.get(5).provoked.repeat, 'provoked display must have a repeat variant')
assert.doesNotMatch(attacks.get(5).provoked.repeat.desc, /收走.*衣|脱下.*衣/, 'repeat display must not strip an already naked player')
assert.equal(attacks.get(2).taskCount, 20)
assert.equal(attacks.get(2).provoked.taskCount, 30)

const battle = source('js/ui/battle.js')
assert.match(battle, /task-count-current/, 'count tasks must expose an interactive counter')
assert.match(battle, /task-count-add-one/, 'count tasks must support adding one repetition')
assert.match(battle, /task-count-add-five/, 'count tasks must support adding five repetitions')
assert.match(battle, /completedCount \+ 5/, 'the five-repetition shortcut must advance by five')
assert.match(battle, /completedCount < requiredCount/, 'count tasks must stay incomplete until the target is reached')
assert.match(battle, /resolveMonsterOrifice\(inspectionPart\)/, 'search inspection must honor occupied orifices')

const story = source('js/systems/camp-p-story.js')
assert.match(story, /function settleCaravanDebt/, 'the gate chapter must settle caravan debt')
assert.match(story, /state\._pCaravanDebt = 0/, 'settlement must clear the debt')
assert.match(story, /function runCaravanDebtTasks/, 'caravan debt must have a playable gate service')
assert.match(story, /CampSystem\.routeTownService/, 'gate service must reuse town restraint routing')
assert.match(story, /state\._pCaravanDebt = debt \+ 20/, 'an interrupted service must increase debt without deadlocking the story')
assert.match(story, /tier >= 2/, 'public demonstration must stay unavailable for the 20G tier')

const battleSystem = source('js/systems/battle.js')
assert.match(battleSystem, /p_caravan_guard_defeat/, 'ordinary caravan defeat must apply a persistent naked state')
assert.match(battleSystem, /battle\.caravanClothesTaken = true/, 'defeat must record that the caravan took the clothes')

console.log('caravan guard tests passed')
