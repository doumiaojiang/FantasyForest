const fs = require('fs')
const assert = require('assert')

const source = fs.readFileSync('js/systems/p-m-escort.js', 'utf8')
assert(source.includes("const BOARD = ['start', 'event', 'empty', 'event', 'guard', 'event', 'empty', 'event', 'finish']"))
assert(source.includes('bellamyTollChance: 0.30') && source.includes('soloTollChance: 0.70'), '门口交通行费概率必须集中配置为30%与70%')
assert.equal((source.match(/id: '[a-z_]+'/g) || []).filter(value => ['vendor', 'tag', 'drunk', 'wall', 'double', 'display', 'throat'].some(id => value.includes(`'${id}'`))).length, 7)
assert(source.includes('position: Math.max') === false, '模块本身不应负责迁移时钳制状态')

global.window = global
let scene = null
const testState = {
  gender: 'female',
  _pMEscortMode: 'bellamy',
  _pMEscort: {
    started: true, gateDone: true, mode: 'bellamy', position: 3,
    currentType: null, currentId: null, currentStep: 0,
    forcedTiles: [], publicNotice: false, completed: false, entryStep: 0, entryEvent: null,
  },
}
global.State = { get: () => testState, save: () => {} }
global.EventBus = { emit: () => {} }
global.CampSystem = { showScene: options => { scene = options } }
global.Dialog = { close: () => {} }
global.BattleUI = { showTaskDialog: async () => false }
;(0, eval)(source)

assert.equal(PMEscortSystem.resume(), true)
assert(scene.body.includes('第 4 / 9 格'))
assert.equal((scene.body.match(/escort-tile/g) || []).length, 9)
assert.equal(scene.actions.length, 1)
assert.equal(scene.actions[0].label, '向前一格')

testState._pMEscort.position = 8
PMEscortSystem.resume()
assert.equal(scene.actions[0].label, '登上会馆台阶')

console.log('p-m-escort-ok')
