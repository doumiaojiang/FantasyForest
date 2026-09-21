const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const files = []
function collect (dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collect(full)
    else if (entry.name.endsWith('.js')) files.push(full)
  }
}
collect(path.join(root, 'js'))

const fragile = []
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const timerBlocks = source.match(/setTimeout\s*\([\s\S]{0,1600}?\},\s*(?:0|50)\s*\)/g) || []
  if (timerBlocks.some(block => /(?:onclick\s*=|addEventListener\s*\(\s*['"]click|querySelector)/.test(block))) {
    fragile.push(path.relative(root, file))
  }
}
if (fragile.length) throw new Error(`Deferred dialog binding remains in: ${fragile.join(', ')}`)

const dialog = fs.readFileSync(path.join(root, 'js/ui/dialog.js'), 'utf8')
if (!/function onMount\s*\(/.test(dialog)) throw new Error('Dialog.onMount is missing')

console.log(`dialog-binding-ok (${files.length} files)`)
