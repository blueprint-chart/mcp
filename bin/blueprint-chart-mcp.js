#!/usr/bin/env node
// bin/blueprint-chart-mcp.js
//
// Entry point for the @blueprint-chart/mcp CLI. Registers a resolver hook
// that fills in `.js` extensions for the extensionless relative imports
// emitted by `tsc` (the project sources target `moduleResolution: "Bundler"`),
// then loads the compiled `dist/cli.js`.
import { register } from 'node:module'

register(new URL('./loader.mjs', import.meta.url))

import('../dist/cli.js').catch((err) => {
  console.error(err)
  process.exit(1)
})
