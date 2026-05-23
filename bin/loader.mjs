// bin/loader.mjs
//
// Node ESM resolver hook that maps extensionless relative imports emitted by
// `tsc` (because the project source targets `moduleResolution: "Bundler"`) to
// concrete `.js` / `index.js` files in `dist/`.
//
// Without this hook, `node dist/cli.js` would fail with ERR_MODULE_NOT_FOUND
// on every relative import. Registered by `bin/blueprint-chart-mcp.js`.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CANDIDATES = ['.js', '.mjs', '/index.js', '/index.mjs']

function fileExists(url) {
  try {
    return existsSync(fileURLToPath(url))
  }
  catch {
    return false
  }
}

export function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    const baseUrl = context.parentURL ? new URL(context.parentURL) : null
    if (baseUrl) {
      for (const ext of CANDIDATES) {
        const candidate = new URL(specifier + ext, baseUrl)
        if (fileExists(candidate)) {
          return nextResolve(specifier + ext, context)
        }
      }
    }
  }
  return nextResolve(specifier, context)
}
