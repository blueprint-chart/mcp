#!/usr/bin/env node
// Recover blindly-authored charts from a Claude Workflow transcript directory.
// Authors are agents whose StructuredOutput has a finalDsl; sample id + expectedType
// come from the matching judge prompt (joined on the verbatim finalDsl).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const argv = process.argv.slice(2)
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : dflt }
const dir = opt('dir', null)
const since = Date.parse(opt('since', '1970-01-01'))
const until = Date.parse(opt('until', '2999-01-01'))
const out = opt('out', 'authored-charts.json')
if (!dir) { console.error('usage: extract-authored-charts.mjs --dir <transcripts> [--since ISO] [--until ISO] [--out file]'); process.exit(1) }

const PERSONA_MARKERS = [
  ['docs-reader', 'You are METHODICAL'],
  ['error-driven-newcomer', 'You are a NEWCOMER'],
  ['data-first-explorer', 'You START from the data'],
]

const authors = []
const judges = []
for (const f of readdirSync(dir).filter(n => n.endsWith('.jsonl'))) {
  const path = join(dir, f)
  const mtime = statSync(path).mtimeMs
  if (mtime < since || mtime >= until) continue
  let prompt = ''
  let structured = null
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    let ev
    try { ev = JSON.parse(line) } catch { continue }
    if (!prompt && ev.type === 'user') {
      const c = ev.message?.content // ACCESSOR — adapt here if event shape differs
      if (typeof c === 'string') prompt = c
      else if (Array.isArray(c)) prompt = c.filter(x => x.type === 'text').map(x => x.text).join('\n')
    }
    if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) { // ACCESSOR — adapt here if needed
      for (const c of ev.message.content) {
        if (c.type === 'tool_use' && /StructuredOutput/i.test(String(c.name)) && c.input && typeof c.input === 'object') structured = c.input
      }
    }
  }
  if (structured && typeof structured.finalDsl === 'string') {
    const persona = (PERSONA_MARKERS.find(([, m]) => prompt.includes(m)) || ['unknown'])[0]
    authors.push({ persona, structured })
  }
  else if (prompt.includes('Read the reference file:')) {
    const id = prompt.match(/Read the reference file: .*\/([a-z0-9-]+)\.bpc/)?.[1]
    const expectedType = prompt.match(/true chart type is "([^"]+)"/)?.[1]
    const dsl = prompt.match(/---\n([\s\S]*?)\n---/)?.[1]
    if (id && dsl) judges.push({ id, expectedType: expectedType ?? null, finalDsl: dsl })
  }
}

const charts = []
for (const a of authors) {
  const j = judges.find(x => x.finalDsl.trim() === String(a.structured.finalDsl).trim())
  if (!j) { console.warn(`UNMAPPED author persona=${a.persona} type=${a.structured.chartTypeChosen}`); continue }
  charts.push({
    id: j.id,
    persona: a.persona,
    expectedType: j.expectedType,
    chosenType: a.structured.chartTypeChosen,
    finalDsl: a.structured.finalDsl,
    valid: a.structured.valid === true,
    rendered: a.structured.rendered === true,
    attemptsToFirstValid: a.structured.attemptsToFirstValid ?? null,
  })
}
charts.sort((x, y) => x.id.localeCompare(y.id) || x.persona.localeCompare(y.persona))
console.log(`authors=${authors.length} judges=${judges.length} mapped=${charts.length}`)
if (charts.length < 45) { console.error(`only ${charts.length} charts recovered (<45) — aborting`); process.exit(1) }
writeFileSync(out, JSON.stringify(charts, null, 2))
console.log(`wrote ${charts.length} charts to ${out}`)
