const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const main = read('js/main.js')
if (/\bdiffName\s*\(\s*difficulty\s*\)/.test(main)) {
  throw new Error('New game still calls the private RecoverySystem diffName helper')
}

const glory = read('js/systems/camp-glory.js')
for (const api of ['isServicePartLocked: townServicePartLocked', 'finishClearedLeave: gloryClearedLeave']) {
  if (!glory.includes(api)) throw new Error(`TownGlorySystem is missing public API: ${api}`)
}

const pillory = read('js/systems/camp-pillory.js')
if (!pillory.includes('start: startPillory')) throw new Error('TownPillorySystem.start is missing')

const crossModuleFiles = [
  'js/systems/camp.js',
  'js/systems/camp-gate.js',
  'js/systems/camp-tavern-patrons.js',
]
const forbiddenCalls = [
  /\bprostitute\s*\(/,
  /\bgloryClearedLeave\s*\(/,
  /\bstartPillory\s*\(/,
  /\btownServicePartLocked\s*\(/,
]
for (const file of crossModuleFiles) {
  const source = read(file)
  for (const pattern of forbiddenCalls) {
    if (pattern.test(source)) throw new Error(`${file} still calls private helper ${pattern}`)
  }
}

const patrons = read('js/systems/camp-tavern-patrons.js')
if (/\bcampClose\s*\(/.test(patrons)) throw new Error('Tavern patrons still call private campClose')

console.log('camp-module-contracts-ok')
