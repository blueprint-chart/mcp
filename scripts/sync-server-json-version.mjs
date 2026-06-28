// scripts/sync-server-json-version.mjs
// Keep server.json's version fields pinned to package.json. Run in the
// semantic-release prepareCmd (after `npm version`) so the MCP registry
// manifest never drifts behind the published npm package.
import { readFileSync, writeFileSync } from 'node:fs'
import { exit } from 'node:process'

const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const version = manifest.version

const serverPath = 'server.json'
const server = JSON.parse(readFileSync(serverPath, 'utf8'))

let changed = false
if (server.version !== version) {
  server.version = version
  changed = true
}
for (const pkg of server.packages ?? []) {
  if (pkg.version !== version) {
    pkg.version = version
    changed = true
  }
}

if (!changed) {
  console.log(`OK  ${serverPath}: already at ${version}`)
  exit(0)
}

writeFileSync(serverPath, JSON.stringify(server, null, 2) + '\n')
console.log(`Synced ${serverPath} -> ${version}`)
