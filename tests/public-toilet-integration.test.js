const fs = require('fs')
const vm = require('vm')

const source = fs.readFileSync('js/systems/camp-glory.js', 'utf8')
const scenes = []
const logs = []
let saves = 0
const state = {
  difficulty: 'normal', gender: 'female', gold: 0,
  _gloryDebt: 0, _gloryFreeService: false, _gloryByGuard: false,
  _gloryByCaptain: false, _gloryJustCleared: false, _gloryWanted: 0,
  _glorySettings: { footService: true }, _prostituteLicensed: false,
  _prisonPardon: false, _gloryManagerCooldown: 0,
}
const context = {
  console,
  window: null,
  State: { get: () => state, save: () => { saves++; return true } },
  CampSystem: {
    gloryFee: 30,
    showScene: options => { scenes.push(options) },
    open: () => {},
    ensurePhase: () => {},
  },
  EventBus: { emit: (name, data) => { if (name === 'ui:log') logs.push(data.text) } },
  Dialog: { close: () => {} },
  ChastitySystem: { isWorn: () => false },
  CONFIG: { difficulty: { normal: { campTax: 0 } } },
  document: {
    querySelectorAll: () => [],
    getElementById: () => null,
    querySelector: () => null,
  },
  Math,
  setInterval, clearInterval, setTimeout, clearTimeout,
}
context.window = context
vm.createContext(context)
vm.runInContext(source, context)

const glory = context.TownGlorySystem
if (!glory) throw new Error('TownGlorySystem did not initialize')

const guardDebt = glory.addDebt({ amount: 100, source: 'guard', reason: '城门罚款', includeEntryFee: true })
if (guardDebt !== 130 || state._gloryDebt !== 130 || !state._gloryByGuard) throw new Error('城门罚款没有正确进入厕所欠债')
if (!glory.hasForcedWork()) throw new Error('欠债后没有进入强制工作状态')
let status = glory.getStatus()
if (!status.forced || status.debt !== 130 || status.source !== 'guard') throw new Error('厕所状态查询返回错误')

if (!glory.resumeForcedWork()) throw new Error('读档恢复没有重新打开厕所工作')
if (!scenes.length || !/荣耀洞/.test(scenes.at(-1).title)) throw new Error('恢复强制工作没有渲染荣耀洞界面')

glory.clearEnforcementSource()
if (state._gloryByGuard || state._gloryByCaptain || state._gloryJustCleared) throw new Error('木枷抵罚没有清除厕所处罚来源')

state._gloryDebt = 0
const captainDebt = glory.addDebt({ amount: 200, source: 'captain', reason: '队长处罚', includeEntryFee: true })
if (captainDebt !== 230 || !state._gloryByCaptain || glory.getStatus().source !== 'captain') throw new Error('队长处罚没有正确进入厕所欠债')

if (saves < 3) throw new Error('厕所公共接口没有立即保存关键状态')
if (!logs.some(text => text.includes('城门罚款')) || !logs.some(text => text.includes('队长处罚'))) throw new Error('厕所公共接口没有记录债务来源')

const callers = {
  gate: fs.readFileSync('js/systems/camp-gate.js', 'utf8'),
  captain: fs.readFileSync('js/systems/camp-tavern-captain.js', 'utf8'),
  prologue: fs.readFileSync('js/systems/prologue-wilderness.js', 'utf8'),
  pillory: fs.readFileSync('js/systems/camp-pillory.js', 'utf8'),
  camp: fs.readFileSync('js/systems/camp.js', 'utf8'),
  journal: fs.readFileSync('js/ui/journal.js', 'utf8'),
}
if (!/addDebt\(\{ amount: 100, source: 'guard'/.test(callers.gate)) throw new Error('城门罚款未使用公共厕所接口')
if (!/reason: '跳过搜身后的赃物罚款'/.test(callers.gate)) throw new Error('赃物栽赃未使用公共厕所接口')
if (!/addDebt\(\{ amount: 200, source: 'captain'/.test(callers.captain)) throw new Error('队长处罚未使用公共厕所接口')
if (!/addDebt\(\{ amount: 100, source: 'prologue'/.test(callers.prologue)) throw new Error('序章战败罚款未使用公共厕所接口')
if (!/resolveManagerEnforcement[\s\S]*?addDebt\(\{ amount: fine, source: 'manager'/.test(source)) throw new Error('管理员 Z6 未使用公共厕所接口')
if (!/TownGlorySystem\.clearEnforcementSource\(\)/.test(callers.pillory)) throw new Error('木枷抵罚未清理厕所处罚来源')
if (!/TownGlorySystem\.resumeForcedWork\(\{ deferWhenBlocked: true \}\)/.test(callers.camp)) throw new Error('营地读档未通过公共接口恢复厕所')
if (!/TownGlorySystem\.getStatus\(\)/.test(callers.journal)) throw new Error('任务札记未通过公共接口查询厕所状态')

console.log('public-toilet-integration-ok')
