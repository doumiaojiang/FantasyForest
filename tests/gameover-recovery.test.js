const fs = require('fs')
const path = require('path')

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const main = read('js/main.js')
const movement = read('js/main-movement.js')

if (!/state\.phase === 'gameover'[\s\S]*?EventBus\.emit\('game:gameover', \{ restored: true \}\)/.test(main)) {
  throw new Error('继续游戏必须重建死亡界面，不能把 gameover 存档交给方向键恢复')
}

if (!/EventBus\.on\('game:gameover'[\s\S]*?_moveLocked = false[\s\S]*?State\.save\(\)[\s\S]*?showActionBar\(\)/.test(movement)) {
  throw new Error('死亡时必须解除移动锁、立即保存并显示重生按钮')
}

console.log('gameover-recovery-ok')
