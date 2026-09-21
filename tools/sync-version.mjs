#!/usr/bin/env node

/**
 * Keep public version labels and static-asset cache keys aligned with CONFIG.version.
 * Usage: node tools/sync-version.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const write = (file, value) => fs.writeFileSync(path.join(root, file), value)

const config = read('js/config.js')
const match = config.match(/\bversion:\s*['"](\d+\.\d+\.\d+)['"]/)
if (!match) throw new Error('Cannot read CONFIG.version from js/config.js')
const version = match[1]

let html = read('index.html')
html = html.replace(/((?:href|src)="(?:style\.css|js\/[^"?]+))(?:\?v=[^"]*)?"/g, `$1?v=${version}"`)
write('index.html', html)

let readme = read('README.md')
const badge = `> 当前版本：v${version}`
if (/^> 当前版本：v\d+\.\d+\.\d+$/m.test(readme)) {
  readme = readme.replace(/^> 当前版本：v\d+\.\d+\.\d+$/m, badge)
} else {
  readme = readme.replace(/^(> 成人向奇幻[^\n]*\n)/m, `$1\n${badge}\n`)
}
write('README.md', readme)

const changelog = read('js/ui/changelog.js')
const newest = changelog.match(/const LOGS\s*=\s*\[\s*\{\s*version:\s*['"]([^'"]+)/s)?.[1]
if (newest !== version) {
  throw new Error(`Newest changelog version (${newest || 'missing'}) must equal CONFIG.version (${version})`)
}

console.log(`Version ${version} synchronized across assets, README and changelog.`)
