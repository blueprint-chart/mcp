// scripts/verify-release-versions.mjs
import { readFileSync } from 'node:fs'
import { argv, env, exit } from 'node:process'

const tag = env.TAG || argv[2]
if (!tag) {
  console.error('Usage: TAG=v0.2.0 node scripts/verify-release-versions.mjs  (or pass tag as arg)')
  exit(1)
}

const expected = tag.startsWith('v') ? tag.slice(1) : tag

const manifestPath = 'package.json'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

if (manifest.version !== expected) {
  console.error(`Version mismatch: ${manifestPath}: version=${manifest.version}, expected=${expected}`)
  exit(1)
}

console.log(`OK  ${manifestPath}: ${manifest.version}`)

// server.json (the MCP registry manifest) must track package.json or the
// registry serves a stale version. Check both the top-level and per-package.
const serverPath = 'server.json'
const server = JSON.parse(readFileSync(serverPath, 'utf8'))
const serverVersions = [server.version, ...(server.packages ?? []).map(p => p.version)]
for (const v of serverVersions) {
  if (v !== expected) {
    console.error(`Version mismatch: ${serverPath}: version=${v}, expected=${expected}`)
    exit(1)
  }
}
console.log(`OK  ${serverPath}: ${server.version}`)

console.log(`\n${manifest.name} at version ${expected} — matches tag ${tag}.`)
