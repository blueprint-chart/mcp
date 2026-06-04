export const meta = {
  name: 'mcp-acceptance-rejudge',
  description: 'Judges-only re-scoring of stored blindly-authored charts with the v2 judge: deterministic two-tier type-match in code, split faithfulness/extras axes, and a 10-chart double-judge variance probe.',
  phases: [
    { title: 'Judge', detail: 'v2 judge per stored chart (+10 probe duplicates)' },
    { title: 'Score', detail: 'two-tier type-match + axes + chrome, variance spreads' },
  ],
}

const SAMPLES_DIR = '/home/dev/Repositories/blueprint-chart/blueprint-chart/packages/lib/src/samples'

// KEEP IN SYNC with mcp-acceptance-swarm.workflow.js (workflow scripts cannot import).
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

// The sandbox may deliver args as a JSON string — parse defensively.
let ARGS = args
if (typeof ARGS === 'string') {
  try { ARGS = JSON.parse(ARGS) } catch { ARGS = null }
}
const charts = (ARGS && Array.isArray(ARGS.charts)) ? ARGS.charts : null
if (!charts || charts.length === 0) {
  throw new Error('Pass args.charts = [{ id, persona, expectedType, chosenType, finalDsl }] (e.g. from test-results/turn3-authored.json)')
}
const PROBE_N = Math.min(10, charts.length)

phase('Judge')
log(`Judging ${charts.length} charts + ${PROBE_N} variance-probe duplicates`)
const mainJudged = await parallel(charts.map((c, i) => () =>
  agent(judgePromptV2(c), { schema: JUDGE_SCHEMA_V2, label: `judge:${c.id}:${c.persona}`, phase: 'Judge' })
    .then(v => ({ chart: c, verdict: v, probeIndex: i < PROBE_N ? i : -1 }))))
const probeJudged = await parallel(charts.slice(0, PROBE_N).map((c, i) => () =>
  agent(judgePromptV2(c), { schema: JUDGE_SCHEMA_V2, label: `probe:${c.id}:${c.persona}`, phase: 'Judge' })
    .then(v => ({ probeIndex: i, verdict: v }))))

phase('Score')
const clean = mainJudged.filter(Boolean)
const probes = probeJudged.filter(Boolean)
const n = clean.length || 1
const avg = f => clean.reduce((a, r) => a + (Number(f(r)) || 0), 0) / n
const r1 = x => Math.round(x * 10) / 10

const rows = clean.map(({ chart, verdict }) => ({
  id: chart.id,
  persona: chart.persona,
  expectedType: chart.expectedType,
  chosenType: chart.chosenType,
  exact: typeMatchExact(chart.chosenType, chart.expectedType),
  defensible: typeMatchDefensible(chart.chosenType, chart.expectedType),
  faithfulness: verdict.faithfulness,
  dataFidelity: verdict.dataFidelity,
  structuralFidelity: verdict.structuralFidelity,
  addedFeatures: verdict.addedFeatures,
  omittedFeatures: verdict.omittedFeatures,
  leakageSuspected: verdict.leakageSuspected,
  verdict: verdict.verdict,
}))

const tally = arr => { const m = {}; arr.forEach(x => { m[x] = (m[x] || 0) + 1 }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`) }
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }

const spreads = { faithfulness: [], dataFidelity: [], structuralFidelity: [] }
for (const p of probes) {
  const main = clean.find(m => m.probeIndex === p.probeIndex)
  if (!main) continue
  for (const axis of Object.keys(spreads)) {
    spreads[axis].push(Math.abs((Number(main.verdict[axis]) || 0) - (Number(p.verdict[axis]) || 0)))
  }
}
const probeComplete = probes.length === PROBE_N
const variance = Object.fromEntries(Object.entries(spreads).map(([axis, xs]) => [axis, { median: median(xs), max: xs.length ? Math.max(...xs) : null, spreads: xs }]))

const stats = {
  charts: clean.length,
  typeMatchExactRate: r1(100 * rows.filter(r => r.exact).length / n) / 100,
  typeMatchDefensibleRate: r1(100 * rows.filter(r => r.defensible).length / n) / 100,
  avgFaithfulness: r1(avg(r => r.verdict.faithfulness)),
  avgDataFidelity: r1(avg(r => r.verdict.dataFidelity)),
  avgStructuralFidelity: r1(avg(r => r.verdict.structuralFidelity)),
  authorAddedChromeIncidents: rows.reduce((a, r) => a + (r.addedFeatures || []).length, 0),
  topAddedFeatures: tally(rows.flatMap(r => r.addedFeatures || [])),
  topOmittedFeatures: tally(rows.flatMap(r => r.omittedFeatures || [])),
  leakageFlags: rows.filter(r => r.leakageSuspected).length,
  byPersona: ['docs-reader', 'error-driven-newcomer', 'data-first-explorer'].map((p) => {
    const rs = rows.filter(r => r.persona === p)
    const m = rs.length || 1
    return {
      persona: p,
      exactRate: r1(100 * rs.filter(r => r.exact).length / m),
      defensibleRate: r1(100 * rs.filter(r => r.defensible).length / m),
      avgFaithfulness: r1(rs.reduce((a, r) => a + r.faithfulness, 0) / m),
    }
  }),
  varianceProbe: { complete: probeComplete, perAxis: variance, accepted: probeComplete && Object.values(variance).every(v => v.median !== null && v.median <= 5) },
}
log(`exact ${Math.round(stats.typeMatchExactRate * 100)}% | defensible ${Math.round(stats.typeMatchDefensibleRate * 100)}% | faithfulness ${stats.avgFaithfulness} | chrome ${stats.authorAddedChromeIncidents} | probe median spreads ${JSON.stringify(Object.fromEntries(Object.entries(variance).map(([k, v]) => [k, v.median])))}`)
return { stats, rows }
