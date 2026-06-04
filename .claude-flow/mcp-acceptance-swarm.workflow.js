export const meta = {
  name: 'mcp-acceptance-swarm',
  description: 'Full blind-reconstruction acceptance swarm for the Blueprint Chart MCP with the v2 judge: leakage-safe briefs, 3-persona blind authoring (deployed author_chart prompt surfaced via args.authorChartPrompt), v2 judging (split axes), deterministic two-tier type-match, synthesis.',
  phases: [
    { title: 'Brief', detail: 'extract leakage-safe briefs from the 17 sample .bpc files' },
    { title: 'Author', detail: '51 blind authoring conversations (sample x persona) via the hosted MCP' },
    { title: 'Judge', detail: 'grade each authored chart against the real reference .bpc' },
    { title: 'Synthesis', detail: 'aggregate v2 stats + markdown report' },
  ],
}

const SAMPLES_DIR = '/home/dev/Repositories/blueprint-chart/blueprint-chart/packages/lib/src/samples'

// KEEP IN SYNC with mcp-acceptance-rejudge.workflow.js (workflow scripts cannot import).
// Policy rationale: .claude-flow/README.md
const ALIASES = { 'vertical-bar': 'bar-vertical', 'horizontal-bar': 'bar-horizontal' }
const EQUIVALENTS = {
  'bar-vertical': ['bar-horizontal'],
  'bar-horizontal': ['bar-vertical'],
  'bar-multi': ['bar-grouped'],
  'bar-grouped': ['bar-multi'],
  'pie': ['donut'],
  'donut': ['pie'],
  'area': ['line'],
  'line': ['area'],
}
const normalizeType = t => ALIASES[String(t || '').toLowerCase().trim()] || String(t || '').toLowerCase().trim()
const typeMatchExact = (chosen, expected) => normalizeType(chosen) === normalizeType(expected)
const typeMatchDefensible = (chosen, expected) =>
  typeMatchExact(chosen, expected) || (EQUIVALENTS[normalizeType(expected)] || []).includes(normalizeType(chosen))

const SAMPLES = [
  { id: 'browser-market', expectedType: 'donut' },
  { id: 'co2-emissions', expectedType: 'bar-vertical' },
  { id: 'coffee-production', expectedType: 'bar-vertical' },
  { id: 'election-polls', expectedType: 'bar-split' },
  { id: 'energy-mix-stacked-area', expectedType: 'area-stacked' },
  { id: 'farm-compass', expectedType: 'area-stacked' },
  { id: 'letter-frequency', expectedType: 'bar-vertical' },
  { id: 'medal-count', expectedType: 'bar-multi' },
  { id: 'population-stacked-bar', expectedType: 'bar-stacked' },
  { id: 'quarterly-revenue', expectedType: 'bar-multi' },
  { id: 'quarterly-stacked-columns', expectedType: 'column-stacked' },
  { id: 'renewable-capacity', expectedType: 'bar-grouped' },
  { id: 'spoken-languages', expectedType: 'bar-horizontal' },
  { id: 'stock-price-area', expectedType: 'area' },
  { id: 'temperature-anomaly', expectedType: 'line' },
  { id: 'unemployment-rates', expectedType: 'line-multi' },
  { id: 'world-population', expectedType: 'pie' },
]

const PERSONAS = [
  { key: 'docs-reader', behavior: 'You are METHODICAL. Before writing any .bpc, call get_grammar, then get_example for a chart type that fits, then describe_chart_type. Aim for a polished, publication-quality chart (sensible sort, value labels, a palette, and a highlight/annotation only if the finding clearly warrants one). Read the docs surface first; write second.' },
  { key: 'error-driven-newcomer', behavior: 'You are a NEWCOMER who does not read docs first. Write a first .bpc guess from intuition WITHOUT calling get_grammar/get_example. Then fix it using ONLY the validate_dsl error and warning messages, iterating. Only fall back to get_grammar/get_example/describe_chart_type when you are totally stuck. Count every attempt until your first valid .bpc.' },
  { key: 'data-first-explorer', behavior: 'You START from the data. First call recommend_chart_type (pass the goal string and the column types/row count you infer from the brief data) and list_chart_types. TRUST the top recommendation unless it is clearly wrong. Then explore with describe_chart_type, search_examples, and list_palettes; actively hunt for features (transforms, value labels, palettes) that improve the chart.' },
]

// Baselines live in test-results/ and the KB; cross-run deltas are computed by the caller.

// The deployed author_chart prompt, surfaced to every persona the way real MCP clients do.
// The sandbox may deliver args as a JSON string — parse defensively. A missing prompt is a
// FATAL config error (a silent '' fallback would unknowingly test personas without the prompt).
let ARGS = args
if (typeof ARGS === 'string') {
  try { ARGS = JSON.parse(ARGS) } catch { ARGS = null }
}
const AUTHOR_CHART_PROMPT = (ARGS && typeof ARGS.authorChartPrompt === 'string' && ARGS.authorChartPrompt.trim() !== '') ? ARGS.authorChartPrompt : null
if (!AUTHOR_CHART_PROMPT) {
  throw new Error('Pass args.authorChartPrompt = the deployed author_chart prompt BODY text (see .claude-flow/README.md). Refusing to run with an empty prompt — that would silently test personas without the guidance under test.')
}

const MCP_TOOLS_QUERY = 'select:mcp__claude_ai_Blueprint_Chart__get_grammar,mcp__claude_ai_Blueprint_Chart__get_example,mcp__claude_ai_Blueprint_Chart__describe_chart_type,mcp__claude_ai_Blueprint_Chart__list_chart_types,mcp__claude_ai_Blueprint_Chart__recommend_chart_type,mcp__claude_ai_Blueprint_Chart__search_examples,mcp__claude_ai_Blueprint_Chart__list_palettes,mcp__claude_ai_Blueprint_Chart__validate_dsl,mcp__claude_ai_Blueprint_Chart__render,mcp__claude_ai_Blueprint_Chart__inspect_dsl'

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['goal', 'dataTableMarkdown', 'source', 'byline', 'note'],
  properties: {
    goal: { type: 'string', description: 'The finding/goal in prose (one or two sentences). Derive from the title/description. Do NOT name a chart type.' },
    dataTableMarkdown: { type: 'string', description: 'The raw data as a markdown table: a category/date column plus one column per series. Numbers verbatim.' },
    source: { type: 'string' },
    byline: { type: 'string' },
    note: { type: 'string', description: 'The editorial note if present, else empty string.' },
  },
}

const AUTHOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['chartTypeChosen', 'finalDsl', 'valid', 'rendered', 'attemptsToFirstValid', 'toolSequence', 'featuresUsed', 'featuresWanted', 'frictionPoints', 'missingCapabilities', 'selfAssessedFidelity'],
  properties: {
    chartTypeChosen: { type: 'string' },
    finalDsl: { type: 'string' },
    valid: { type: 'boolean', description: 'true if validate_dsl returned valid' },
    rendered: { type: 'boolean', description: 'true if render returned an SVG' },
    attemptsToFirstValid: { type: 'integer' },
    toolSequence: { type: 'array', items: { type: 'string' } },
    featuresUsed: { type: 'array', items: { type: 'string' } },
    featuresWanted: { type: 'array', items: { type: 'string' } },
    frictionPoints: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'area', 'description'], properties: { severity: { type: 'string' }, area: { type: 'string' }, description: { type: 'string' } } } },
    missingCapabilities: { type: 'array', items: { type: 'string' } },
    selfAssessedFidelity: { type: 'integer' },
  },
}

const JUDGE_SCHEMA_V2 = {
  type: 'object',
  additionalProperties: false,
  required: ['faithfulness', 'dataFidelity', 'structuralFidelity', 'addedFeatures', 'omittedFeatures', 'leakageSuspected', 'divergences', 'verdict'],
  properties: {
    faithfulness: { type: 'integer', description: 'Closeness to the reference IGNORING author additions. 90-100 same publication; 70-89 minor drift; 50-69 notable omissions; <50 different chart.' },
    dataFidelity: { type: 'integer' },
    structuralFidelity: { type: 'integer' },
    addedFeatures: { type: 'array', items: { type: 'string', enum: ['valueLabels', 'legend', 'sort', 'colorPalette', 'highlight', 'colorize', 'annotation', 'tooltips', 'gridStyle', 'labelPosition', 'sourceUrl', 'byline', 'note', 'scenes', 'displayAsPercentage'] } },
    omittedFeatures: { type: 'array', items: { type: 'string', enum: ['valueLabels', 'legend', 'sort', 'colorPalette', 'highlight', 'colorize', 'annotation', 'tooltips', 'gridStyle', 'labelPosition', 'sourceUrl', 'byline', 'note', 'scenes', 'displayAsPercentage'] } },
    leakageSuspected: { type: 'boolean' },
    divergences: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
  },
}

function briefPrompt(s) {
  return `You are preparing a journalist's BRIEF from a reference chart file, for a blind reconstruction test.

Read the file: ${SAMPLES_DIR}/${s.id}.bpc

Produce a leakage-safe brief an author can work from WITHOUT seeing the reference. Extract:
- goal: the finding in plain prose (from the title + description). Describe WHAT the data shows. CRITICALLY: do NOT mention or imply any chart type, palette name, annotation wording, highlight target, sort order, or other reference-specific styling choice. Those are what we are testing the author to choose independently. Leaking them is a test-design bug.
- dataTableMarkdown: the raw data as a markdown table (the category or date column, then one column per series). Copy the numbers exactly. Include the series names if the data uses _series.
- source, byline, note: copy these metadata fields verbatim if present (note = "" if absent).

Return ONLY the structured object. Do not include the chart type or any styling in any field.`
}

function authorPrompt(job) {
  const b = job.s.brief
  return `Your MCP client surfaces this authoring guidance from the Blueprint Chart server (its author_chart prompt). A real user's assistant sees this before working; follow it, expressing your own working style within it:
---
${AUTHOR_CHART_PROMPT}
---

You are authoring a Blueprint Chart (.bpc) file BLIND, to stress-test the Blueprint Chart MCP server. ${job.p.behavior}

HARD RULES:
1. MCP-ONLY KNOWLEDGE. The ONLY way you know the .bpc format is the Blueprint Chart MCP tools. You have NO prior .bpc knowledge. If the MCP does not reveal a feature, you do not know it exists. FIRST load the tools by calling ToolSearch with query "${MCP_TOOLS_QUERY}", then use ONLY those mcp__claude_ai_Blueprint_Chart__* tools.
2. BLIND. You have only the brief below. Do NOT read any file, do NOT open ${SAMPLES_DIR}, do NOT look for a reference. Working from a reference is cheating and ruins the test.
3. DONE = valid + renders. Iterate until validate_dsl returns valid:true AND render returns an SVG. Cap at 8 author attempts; if a tool call times out, retry it once.
4. Be an honest reporter. Log anything confusing, missing, an unactionable error, or a feature you wanted but could not express. We are stress-testing the MCP, not grading you.
5. Never paste SVG or PNG content anywhere.

THE BRIEF
Goal: ${b.goal}
Data:
${b.dataTableMarkdown}
Source: ${b.source}
Byline: ${b.byline}
Note: ${b.note}

When done, return the structured object: the chart type you chose, your final .bpc text, whether it validated and rendered, attempts-to-first-valid, the ordered tool sequence you used, features you used, features you wanted but could not express, friction points (severity/area/description), missing capabilities, and your self-assessed fidelity 0-100.`
}

function judgePromptV2(chart) {
  return `You are an independent judge grading a blindly-authored Blueprint Chart against the REAL reference.

Read the reference file: ${SAMPLES_DIR}/${chart.id}.bpc

The author (who never saw the reference) produced this .bpc:
---
${chart.finalDsl}
---

Score these axes. Do NOT score chart-type match (that is computed elsewhere).

1. faithfulness (0-100) — closeness to the reference IGNORING anything the author ADDED. Anchored bands, pick within the band that fits:
   - 90-100: a reader would consider it the same publication — data, framing, structure faithful.
   - 70-89: minor framing/styling drift (e.g. different palette default, label phrasing).
   - 50-69: notable omissions of reference content or features.
   - <50: effectively a different chart.
2. dataFidelity (0-100) — all reference data points present and numerically correct.
3. structuralFidelity (0-100) — title / description / source / series structure vs the reference.
4. addedFeatures — features present in the AUTHORED chart but absent from the reference. Use ONLY the fixed vocabulary the schema enforces; one entry per feature, no free text.
5. omittedFeatures — features the REFERENCE has that the authored chart lacks. Same fixed vocabulary. Count "tooltips" as omitted ONLY if the reference sets tooltips explicitly.
6. leakageSuspected — true only if the authored chart reproduces a reference-specific choice it could only know from a leaked brief (exact palette name, exact annotation wording).
7. divergences — short list of the most important differences. verdict — one sentence.

Return ONLY the structured object.`
}

// ---- Phase 1: briefs ----
phase('Brief')
const briefed = await parallel(SAMPLES.map(s => () =>
  agent(briefPrompt(s), { schema: BRIEF_SCHEMA, label: `brief:${s.id}`, phase: 'Brief' })
    .then(brief => ({ ...s, brief }))
))
const okBriefs = briefed.filter(Boolean)
log(`Extracted ${okBriefs.length}/${SAMPLES.length} briefs`)

// ---- Phase 2+3: author -> judge, pipelined per (sample x persona) ----
const jobs = okBriefs.flatMap(s => PERSONAS.map(p => ({ s, p })))
log(`Running ${jobs.length} blind authoring conversations`)

const results = await pipeline(
  jobs,
  (job) => agent(authorPrompt(job), { schema: AUTHOR_SCHEMA, label: `author:${job.s.id}:${job.p.key}`, phase: 'Author' })
    .then(author => ({ job, author })),
  (prev) => agent(judgePromptV2({ id: prev.job.s.id, finalDsl: prev.author.finalDsl }), { schema: JUDGE_SCHEMA_V2, label: `judge:${prev.job.s.id}:${prev.job.p.key}`, phase: 'Judge' })
    .then(verdict => ({ job: prev.job, author: prev.author, verdict })),
)

const clean = results.filter(r => r && r.author && r.verdict)
const total = clean.length || 1

const avgOf = (rs, f) => rs.length ? rs.reduce((a, r) => a + (Number(f(r)) || 0), 0) / rs.length : 0
const r1 = (n) => Math.round(n * 10) / 10

const newcomer = clean.filter(r => r.job.p.key === 'error-driven-newcomer')
const tally = (arr) => { const m = {}; arr.forEach(x => { m[x] = (m[x] || 0) + 1 }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} (${v})`) }

const byPersona = PERSONAS.map((p) => {
  const rs = clean.filter(r => r.job.p.key === p.key)
  const m = rs.length || 1
  return {
    persona: p.key,
    exactRate: r1(100 * rs.filter(r => typeMatchExact(r.author.chartTypeChosen, r.job.s.expectedType)).length / m),
    defensibleRate: r1(100 * rs.filter(r => typeMatchDefensible(r.author.chartTypeChosen, r.job.s.expectedType)).length / m),
    avgFaithfulness: r1(avgOf(rs, r => r.verdict.faithfulness)),
    avgAttemptsToValid: r1(avgOf(rs, r => r.author.attemptsToFirstValid)),
  }
})

const bySample = okBriefs.map((s) => {
  const rs = clean.filter(r => r.job.s.id === s.id)
  return {
    id: s.id,
    expectedType: s.expectedType,
    exact: `${rs.filter(r => typeMatchExact(r.author.chartTypeChosen, s.expectedType)).length}/${rs.length}`,
    defensible: `${rs.filter(r => typeMatchDefensible(r.author.chartTypeChosen, s.expectedType)).length}/${rs.length}`,
    avgFaithfulness: Math.round(avgOf(rs, r => r.verdict.faithfulness)),
    chosen: rs.map(r => `${r.job.p.key}:${r.author.chartTypeChosen}`),
  }
})

const stats = {
  conversations: clean.length,
  authoringSuccessRate: r1(100 * avgOf(clean, r => (r.author.valid && r.author.rendered ? 1 : 0))) / 100,
  typeMatchExactRate: r1(100 * clean.filter(r => typeMatchExact(r.author.chartTypeChosen, r.job.s.expectedType)).length / total) / 100,
  typeMatchDefensibleRate: r1(100 * clean.filter(r => typeMatchDefensible(r.author.chartTypeChosen, r.job.s.expectedType)).length / total) / 100,
  avgFaithfulness: r1(avgOf(clean, r => r.verdict.faithfulness)),
  avgDataFidelity: r1(avgOf(clean, r => r.verdict.dataFidelity)),
  avgStructuralFidelity: r1(avgOf(clean, r => r.verdict.structuralFidelity)),
  avgAttemptsToFirstValid: r1(avgOf(clean, r => r.author.attemptsToFirstValid)),
  newcomerAttemptsToValid: r1(avgOf(newcomer, r => r.author.attemptsToFirstValid)),
  leakageFlags: clean.filter(r => r.verdict.leakageSuspected).length,
  authorAddedChromeIncidents: clean.reduce((a, r) => a + ((r.verdict.addedFeatures || []).length), 0),
  topAddedFeatures: tally(clean.flatMap(r => r.verdict.addedFeatures || [])),
  topOmittedFeatures: tally(clean.flatMap(r => r.verdict.omittedFeatures || [])),
  topFrictionAreas: tally(clean.flatMap(r => (r.author.frictionPoints || []).map(f => f.area))),
  topMissingCapabilities: tally(clean.flatMap(r => r.author.missingCapabilities || [])),
  byPersona,
  bySample,
}

log(`exact ${Math.round(stats.typeMatchExactRate * 100)}% | defensible ${Math.round(stats.typeMatchDefensibleRate * 100)}% | faithfulness ${stats.avgFaithfulness} | chrome ${stats.authorAddedChromeIncidents}`)

// ---- Phase 4: synthesis ----
phase('Synthesis')
const synthesisMarkdown = await agent(
  `You are writing the synthesis report for a Blueprint Chart MCP acceptance swarm run under the v2 judge (deterministic two-tier type-match computed in code; faithfulness scored ignoring author additions; added/omitted features from a fixed vocabulary). See .claude-flow/README.md for axis definitions.

Aggregate stats (JSON):
${JSON.stringify(stats, null, 2)}

Write a concise markdown report:
1. Headline: exact and defensible type-match rates, faithfulness, chrome incidents, newcomer attempts.
2. Per-persona table (both tiers + faithfulness + attempts).
3. Per-sample table (exact, defensible, faithfulness, chosen types), calling out samples below 2/3 defensible.
4. Restraint: top added features vs top omitted features.
5. Friction + missing capabilities.
6. A short next-turn backlog.
Do NOT compare to past runs (cross-run deltas are computed by the caller from test-results/). Be direct and quantitative. Return ONLY the markdown.`,
  { label: 'synthesis', phase: 'Synthesis' },
)

return {
  stats,
  synthesisMarkdown,
  results: clean.map(r => ({
    id: r.job.s.id,
    persona: r.job.p.key,
    expectedType: r.job.s.expectedType,
    chosenType: r.author.chartTypeChosen,
    typeMatchExact: typeMatchExact(r.author.chartTypeChosen, r.job.s.expectedType),
    typeMatchDefensible: typeMatchDefensible(r.author.chartTypeChosen, r.job.s.expectedType),
    faithfulness: r.verdict.faithfulness,
    dataFidelity: r.verdict.dataFidelity,
    addedFeatures: r.verdict.addedFeatures,
    omittedFeatures: r.verdict.omittedFeatures,
    attemptsToFirstValid: r.author.attemptsToFirstValid,
    valid: r.author.valid,
    rendered: r.author.rendered,
    leakageSuspected: r.verdict.leakageSuspected,
    finalDsl: r.author.finalDsl,
  })),
}
