const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'main-movement.js'), 'utf8')

if (!/tile\.type === TILE\.TREASURE[\s\S]*?_stepsRemaining <= 0[\s\S]*?readyToRoll\(\)[\s\S]*?return 'stopped'/.test(source)) {
  throw new Error('宝箱消耗最后一步后必须直接恢复方向键')
}

if (!/treasureResult === 'resume'[\s\S]*?!_isWalking && _stepsRemaining > 0[\s\S]*?readyToRoll\(true\)/.test(source)) {
  throw new Error('宝箱仍有余步但自动行走中断时必须保留余步并恢复方向键')
}

if (!/catch \(error\)[\s\S]*?移动事件处理失败，已恢复方向键[\s\S]*?readyToRoll\(_stepsRemaining > 0\)/.test(source)) {
  throw new Error('移动事件异常必须释放移动锁并恢复方向键')
}

console.log('treasure-movement-ok')
