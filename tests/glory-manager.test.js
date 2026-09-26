const fs = require('fs')

const source = fs.readFileSync('js/systems/camp-glory.js', 'utf8')
const schema = fs.readFileSync('js/state-schema.js', 'utf8')
const migrations = fs.readFileSync('js/state-migrations.js', 'utf8')

if (!/Math\.min\(25, 5 \+ Math\.floor\(\(state\._gloryWanted \|\| 0\) \/ 5\)\)/.test(source)) {
  throw new Error('管理员出现率必须随危险值从 5% 增长并封顶 25%')
}
if (!/state\._gloryManagerCooldown = 3/.test(source) || !/cooldown - 1/.test(source)) {
  throw new Error('管理员事件后必须冷却三次服务')
}
for (const expected of [
  'payMultiplier: 1, wantedDelta: -3',
  'basePay: false, wantedDelta: -8',
  'payMultiplier: 1.5, wantedDelta: 0',
  'payMultiplier: 2, extraSeconds: 30, wantedDelta: -5',
  'free: true, wantedDelta: 10',
  'enforcement: true',
]) {
  if (!source.includes(expected)) throw new Error(`管理员骰子缺少结果：${expected}`)
}
if (!/wanted < 40[\s\S]*?wanted < 70[\s\S]*?TownPrisonSystem\.enter/.test(source)) {
  throw new Error('Z6 必须按低中高危险值执行没收、罚款和收监')
}
if (!/managerCooldown: 0/.test(schema) || !/_gloryManagerCooldown: \['glory', 'managerCooldown'\]/.test(schema)) {
  throw new Error('管理员冷却必须进入 glory 存档领域')
}
if (!/_gloryManagerCooldown = Math\.max\(0, Math\.min\(3/.test(migrations)) {
  throw new Error('管理员冷却必须经过迁移清洗')
}

console.log('glory-manager-ok')
