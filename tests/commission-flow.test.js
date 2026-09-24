const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const context = {}
context.window = context
vm.createContext(context)
vm.runInContext(read('js/data/stories/prologue.js'), context)
vm.runInContext(read('js/systems/prologue-wilderness.js'), context)
const commission = context.window.__PrologueRuntime.wilderness

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
if (!/欲缚镇 · 序章/.test(journal)) throw new Error('Prologue task group must use the chosen chapter title')
if (/stage >= 10 && pStage <= 1[\s\S]{0,180}主线第一章/.test(journal)) throw new Error('Role selection must remain inside the prologue')
const pStory = read('js/systems/prologue-town.js')
const prologueContent = read('js/data/stories/prologue.js')
if (!/choices\.slaver[\s\S]{0,100}disabled: true/.test(pStory) || !/S 路线 · 商团执行人（开发中）/.test(prologueContent)) throw new Error('S route must be visibly disabled')
if (!/M 路线 · 受支配者/.test(prologueContent) || !/自由身路线 · 受监视的旅人/.test(prologueContent)) throw new Error('M and free routes must remain selectable and labeled')
if (!/_pChapterOneLocked = true/.test(pStory)) throw new Error('Role selection must pause before chapter one')
if (!/state\._pBridgePermitAcquired \? '沿桥墩下去' : '返回旧桥'/.test(journal)) throw new Error('Victory and capture must have different bridge directions')
if (!/_pDefeatDispatchPending/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Ordinary caravan defeat dispatch must persist across reloads')
if (!/_pBanditDefeatCount/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Bandit defeat count must persist across retries')
if (!/StatusSystem\.has\('naked'\) \|\| state\._pBanditClothesLocked/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Bandit victory must recover locked original clothes even after buying replacements')
if (!/_pBanditMarkChoice === 'scrubbed'/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Revenge witness dialogue must remember whether the body writing was scrubbed')
if (!/settleBanditRansomDebt/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Bandit ransom debt must have a payoff route')
if (!/resetPostPrologueState\(state\)[\s\S]{0,180}state\._wrongCommissionStage = 5/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Caravan guard defeat must clear stale post-prologue state before returning to stage 5')
if (!/startStep: result\.punishmentStep/.test(read('js/systems/prologue-wilderness.js')) || !/startStep: state\._pDefeatPunishmentStep/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Both caravan defeat routes must resume from the last completed punishment step')
if (!/showBanditNakedGate/.test(read('js/systems/camp-gate.js'))) throw new Error('Locked-clothes nudity must trigger a dedicated gate reaction')
if (!/resumeCampStory/.test(read('js/game-flow.js'))) throw new Error('GameFlow must resume persisted caravan story scenes')
const movement = read('js/main-movement.js')
if (!/tile\.type === TILE\.BRIDGE && _stepsRemaining > 0/.test(movement)) throw new Error('Passing the old bridge must pause before remaining movement skips it')
if (!/下桥进入据点/.test(movement) || !/继续前进/.test(movement)) throw new Error('Old bridge pass prompt must offer stop and continue choices')
if (!/TILE\.BANDIT_CAMP/.test(movement)) throw new Error('Bandit camp tile must stop movement and open its scene')
if (!/visitBanditCamp/.test(read('js/systems/prologue-wilderness.js'))) throw new Error('Bandit camp needs a dedicated persistent map entry')

const map = read('js/data/map.js')
if (!/"强盗营地"/.test(map) || !/BANDIT_CAMP:\s*'bandit-camp'/.test(map)) throw new Error('Old bridge must have a bandit camp tile below it')

console.log('commission-flow-ok')
