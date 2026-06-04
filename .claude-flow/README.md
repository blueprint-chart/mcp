# Blueprint Chart MCP — Acceptance Harness

## What this is

This is a blind-reconstruction stress test of the hosted Blueprint Chart MCP's
authoring ergonomics. Seventeen bundled sample charts are each rebuilt by three
authoring personas (51 conversations). Authors work from a leakage-safe brief and
**never see the reference** `.bpc`; independent judges then grade each authored
chart against the real reference file on disk.

It measures one thing: **can an LLM discover and wield the MCP to produce the
right chart type and a faithful reconstruction** of the intended chart, using only
what the MCP tools reveal. It does **not** measure renderer correctness — whether a
given `.bpc` draws the right pixels is the job of the `@blueprint-chart/lib` test
suite, not this harness. A chart can score perfectly here and still render wrong;
that is by design.

Methodology history, baselines, and the reasoning behind every policy choice live
in the knowledge base. See the KB pages **`mcp-acceptance-testing`** (the harness
itself) and **`mcp-authoring-improvements`** (the per-turn baseline table). This
README is the policy document; the KB is the running record.

## How to run

These are **Claude Workflow-tool scripts**, not node scripts. They run inside a
Claude Code session via the `Workflow` tool and rely on sandbox globals
(`agent` / `parallel` / `pipeline` / `phase` / `log` / `args`). Running them with
`node` does nothing — there is no `node` entry point and the globals are undefined.

**Full swarm** — briefs, blind authoring, judging, and synthesis end to end:

```
Workflow({
  scriptPath: ".claude-flow/mcp-acceptance-swarm.workflow.js",
  args: { authorChartPrompt: "<the deployed author_chart prompt BODY text>" }
})
```

`authorChartPrompt` is surfaced to every authoring persona exactly the way a real
MCP client surfaces an MCP prompt to its assistant — paste the deployed
`author_chart` prompt body verbatim. Cost: ≈ 120 agents, ~3M tokens, ~10–15 min.

**Re-judge** — judges-only re-scoring of a stored corpus, no authoring:

```
Workflow({
  scriptPath: ".claude-flow/mcp-acceptance-rejudge.workflow.js",
  args: { charts: <array from test-results/turnN-authored.json> }
})
```

Cost: ≈ 61 agents (51 charts + 10 variance-probe duplicates), ~0.5M tokens.

**Extraction** — recover a corpus from raw workflow transcripts:

```
node scripts/extract-authored-charts.mjs --dir <workflow-transcripts-dir> \
  [--since ISO] [--until ISO] --out test-results/turnN-authored.json
```

This one **is** a node script (cost: free, local file I/O). It is mtime-windowed
on the transcript files and **aborts if it recovers fewer than 45 charts**. Note:
the v2 swarm already includes `finalDsl` in its returned `results`, so a corpus can
be saved directly from a run's output — extraction is only needed for older runs
whose results lack `finalDsl`.

## The modality trap

The harness measures the **hosted** MCP — the `mcp__claude_ai_Blueprint_Chart__*`
tools served by the deployed server. It does not, and cannot, measure a local build
or an undeployed branch.

Before trusting any run, **probe that the deployment serves the version under
test**. Concretely: call `recommend_chart_type` and confirm it returns the
`guidance` field that the current version adds. If the deployment is stale, the run
measures the old server, not your change.

Never compare runs across modalities or against undeployed changes. A number from
the hosted MCP and a number from a local build are not the same experiment.

## Type-match policy (v2)

Chart-type match is computed **in code**, in two tiers. The judge never scores
type — it is removed from the judge schema entirely, because type identity is a
mechanical question that LLM judges answered inconsistently in v1.

- **exact**: the chosen type normalizes to the same string as the expected type.
- **defensible**: exact, OR the chosen type is a listed equivalent of the expected
  type.

Aliases normalize **first** (`vertical-bar` → `bar-vertical`,
`horizontal-bar` → `bar-horizontal`), then equivalence is checked.

### Equivalents (defensible substitutions, symmetric)

| Expected     | Accepted as defensible |
| ------------ | ---------------------- |
| bar-vertical | bar-horizontal         |
| bar-multi    | bar-grouped            |
| pie          | donut                  |
| area         | line                   |

Each pair is symmetric (both directions are encoded in `EQUIVALENTS`).

### NOT equivalent

- **line-multi ↮ bar-multi** — a line-multi makes a trend statement over a
  continuous axis; a bar-multi makes a grouped categorical comparison. Different
  claims about the data.
- **line-multi ↮ area-stacked** — stacking exists to show composition (parts of a
  whole over time); plain multi-line does not. Composition is the point.
- **bar-stacked ↮ bar-grouped** — stacked shows composition, grouped shows
  side-by-side comparison. This is the exact pair v1 judges flip-flopped on.
- **line ↮ line-multi** — series count is a data statement, not a styling choice;
  collapsing or inventing series changes what the chart asserts.

## Judge v2 axes

The judge returns a fixed structured object (`JUDGE_SCHEMA_V2`):

- **faithfulness** (0–100) — closeness to the reference, scored **IGNORING anything
  the author added**, on anchored bands: 90–100 same publication; 70–89 minor
  framing/styling drift; 50–69 notable omissions; <50 effectively a different
  chart. Author additions are captured separately (see `addedFeatures`) so a richer
  chart is never penalized as unfaithful.
- **dataFidelity** (0–100) — all reference data points present and numerically
  correct.
- **structuralFidelity** (0–100) — title / description / source / series structure
  vs the reference.
- **addedFeatures / omittedFeatures** — drawn from a **fixed 15-item vocabulary**
  (`valueLabels, legend, sort, colorPalette, highlight, colorize, annotation,
  tooltips, gridStyle, labelPosition, sourceUrl, byline, note, scenes,
  displayAsPercentage`), one entry per feature, no free text. Tooltips rule: count
  `tooltips` as **omitted only if the reference sets tooltips explicitly**.
- **leakageSuspected** — true only if the authored chart reproduces a
  reference-specific choice it could only know from a leaked brief (exact palette
  name, exact annotation wording). A nonzero count means a test-design bug, not an
  author failure.

### The v1→v2 break

`overallFidelity` and judge-scored `chartTypeMatch` are **retired**. v1 collapsed
type-match and fidelity into single LLM-scored numbers; v2 splits faithfulness from
author additions and moves type-match into deterministic code.

The v1 numbers and the deterministic v2 type-match recompute on the same corpora:

| Turn | v1 type-match | v1 overallFidelity | v2 exact      | v2 defensible |
| ---- | ------------- | ------------------ | ------------- | ------------- |
| 1    | 67%           | 73.1               | —             | —             |
| 2    | 84.3%         | 77.5               | 27/51 (52.9%) | 37/51 (72.5%) |
| 3    | 76.5%         | 80.0               | 25/51 (49.0%) | 37/51 (72.5%) |

The apparent v1 turn-2→3 "regression" was **judge noise plus judge generosity** —
v1 judges accepted substitutions the v2 policy rejects (e.g. line-multi for
bar-multi). Under the deterministic recompute, defensible type-match is flat
(72.5%) across both turns.

Rule: **never compare v1-judged numbers to v2 axes.** The only valid cross-era
comparison is the deterministic type-match recompute, because it is computed by the
same code on both corpora.

## Variance probe

Every re-judge run double-judges the **first 10 charts** — each is scored twice by
independent judge agents. The probe quantifies how much the LLM judge wobbles on
identical input.

- **Acceptance bar**: **median per-axis spread ≤ 5 points** across the three scored
  axes (faithfulness, dataFidelity, structuralFidelity).
- **Where it surfaces**: `stats.varianceProbe.accepted` (boolean), with the full
  per-axis median/max/spread breakdown under `stats.varianceProbe.perAxis`.

If the probe **fails** (judge too noisy to trust), escalate to **programmatic
`compare-bpc` diffing**: parse both `.bpc` files with the lib parser and diff them
mechanically; the LLM only narrates the mechanical diff rather than scoring it. The
judge stops being the measurement instrument.

## Re-baseline procedure

After a run clears the variance probe and you accept it:

1. **Save provenance** into `test-results/`: the synthesis `report`, the `stats`
   object, and the `results` array. This directory is **gitignored** — the durable
   provenance record lives in the KB, `test-results/` is a local scratch copy.
2. **Update the KB baseline table** on `mcp-authoring-improvements` with the new
   turn's numbers.
3. **Flag the judge version on every number.** A bare fidelity figure is
   meaningless without its judge era; always write `v2`.
4. **Keep `EQUIVALENTS` byte-identical** across the two workflow files — they cannot
   import a shared module, so the table is duplicated and must not drift. Diff
   check:

   ```
   diff \
     <(sed -n '/^const ALIASES/,/^const typeMatchDefensible/p' .claude-flow/mcp-acceptance-swarm.workflow.js) \
     <(sed -n '/^const ALIASES/,/^const typeMatchDefensible/p' .claude-flow/mcp-acceptance-rejudge.workflow.js)
   ```

   Empty diff = in sync.

> Why is this directory versioned at all? `.claude-flow/` is gitignored except
> `*.workflow.js` and `README.md` (negations in `.gitignore`). The turn-1 harness
> was lost to the ignore rule — those negations exist so the policy and the scripts
> survive.
