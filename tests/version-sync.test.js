const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const configVersion = read('js/config.js').match(/\bversion:\s*['"](\d+\.\d+\.\d+)['"]/)?.[1]
if (!configVersion) throw new Error('CONFIG.version missing')

const html = read('index.html')
const assetVersions = [...html.matchAll(/(?:style\.css|js\/[^"?]+)\?v=(\d+\.\d+\.\d+)/g)].map(match => match[1])
if (!assetVersions.length) throw new Error('No versioned assets found')
const mismatches = [...new Set(assetVersions.filter(version => version !== configVersion))]
if (mismatches.length) throw new Error(`Asset cache versions differ from CONFIG.version: ${mismatches.join(', ')}`)

const newestChangelog = read('js/ui/changelog.js').match(/const LOGS\s*=\s*\[\s*\{\s*version:\s*['"]([^'"]+)/s)?.[1]
if (newestChangelog !== configVersion) throw new Error(`Newest changelog is ${newestChangelog}, expected ${configVersion}`)

if (!read('README.md').includes(`> 当前版本：v${configVersion}`)) throw new Error('README current version is out of sync')

console.log(`version-sync-ok (${configVersion}, ${assetVersions.length} assets)`)
