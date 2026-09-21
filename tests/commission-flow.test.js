const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const context = { window: {} }
vm.createContext(context)
vm.runInContext(read('js/systems/commission.js'), context)
const commission = context.window.CommissionSystem

const capturedText = commission.letterAfterText({
  _wrongCommissionStage: 5,
  _wrongCommissionLeads: { barkeep: true, blacksmith: true },
  _pBridgePermitAcquired: false,
})
if (/许可盖着|拿到许可/.test(capturedText)) throw new Error('Captured route incorrectly claims the permit')

const victoryText = commission.letterAfterText({
  _wrongCommissionStage: 5,
  _wrongCommissionLeads: { barkeep: true, blacksmith: true },
  _pBridgePermitAcquired: true,
})
if (!/许可/.test(victoryText)) throw new Error('Victory route lost permit evidence')

const barkeepText = commission.letterAfterText({
  _wrongCommissionStage: 3,
  _wrongCommissionLeads: { barkeep: true, blacksmith: false },
})
if (!/老板娘/.test(barkeepText) || !/铁匠铺/.test(barkeepText)) throw new Error('Partial investigation text is unreachable')

const battle = read('js/systems/battle.js')
if (!/banditHideout\s*\?\s*\{\s*x:\s*10,\s*y:\s*9\s*\}/.test(battle)) throw new Error('Bandit defeat does not return to the old bridge')

const camp = read('js/systems/camp.js')
const mainlinePriority = camp.indexOf("state._wrongCommissionStage || 0) >= 10")
const gloryPriority = camp.indexOf('const forcedGlory')
if (mainlinePriority < 0 || gloryPriority < 0 || mainlinePriority > gloryPriority) throw new Error('First gate chapter must precede ordinary glory debt')

const journal = read('js/ui/journal.js')
if (!/state\._pBridgePermitAcquired \? '沿桥墩下去' : '返回旧桥'/.test(journal)) throw new Error('Victory and capture must have different bridge directions')
if (!/_pDefeatDispatchPending/.test(read('js/systems/commission.js'))) throw new Error('Ordinary caravan defeat dispatch must persist across reloads')
if (!/_pBanditDefeatCount/.test(read('js/systems/commission.js'))) throw new Error('Bandit defeat count must persist across retries')
if (!/showBanditNakedGate/.test(read('js/systems/camp-gate.js'))) throw new Error('Locked-clothes nudity must trigger a dedicated gate reaction')
if (!/resumeCampStory/.test(read('js/game-flow.js'))) throw new Error('GameFlow must resume persisted caravan story scenes')
const movement = read('js/main-movement.js')
if (!/tile\.type === TILE\.BRIDGE && _stepsRemaining > 0/.test(movement)) throw new Error('Passing the old bridge must pause before remaining movement skips it')
if (!/下桥进入据点/.test(movement) || !/继续前进/.test(movement)) throw new Error('Old bridge pass prompt must offer stop and continue choices')

console.log('commission-flow-ok')
