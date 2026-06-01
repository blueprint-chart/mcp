/**
 * Per-(chartType × key) capability metadata. `key` is a chart property OR a
 * directive name (`highlight`, `colorize`, `annotation`, `transform`, `scene`).
 *
 * Phase 1: this matrix is MCP-local, seeded from the authoring usability test
 * (test-results/mcp-authoring-report.md). Phase 2 promotes it into
 * @blueprint-chart/lib as renderer-verified metadata; the MCP then consumes
 * lib's matrix and deletes this file.
 *
 * Design: DEFAULT every cell to { applicable: true, implemented: true }
 * ("supported") and list ONLY non-default cells in OVERRIDES. This keeps
 * warnings high-precision (no false positives on the 34 bundled samples) and
 * means a new chart type needs zero matrix edits to avoid spurious warnings.
 */
export interface CapabilityCell {
  applicable: boolean
  implemented: boolean
  note?: string
}

export type CapabilityStatus = 'supported' | 'not-implemented' | 'inapplicable'

const SUPPORTED = Object.freeze<CapabilityCell>({ applicable: true, implemented: true })

export function statusOf(cell: CapabilityCell): CapabilityStatus {
  if (!cell.applicable) {
    return 'inapplicable'
  }
  if (!cell.implemented) {
    return 'not-implemented'
  }
  return 'supported'
}

const OVERRIDES: Readonly<Record<string, Readonly<Record<string, Readonly<CapabilityCell>>>>> = {
  donut: {
    sort: { applicable: false, implemented: false, note: 'Slice order on a donut follows data order; use a `transform sort` on the data instead.' },
    sortMode: { applicable: false, implemented: false, note: 'sortMode applies to grouped/stacked charts, not donut.' },
    colorize: { applicable: true, implemented: false, note: 'Per-slice colorize is not yet honored by the donut renderer; use `colorPalette` or `colors`.' },
    valueLabels: { applicable: false, implemented: false, note: 'Donut shows slice labels; use `displayAsPercentage` / `tooltips` instead of valueLabels.' },
  },
  pie: {
    sort: { applicable: false, implemented: false, note: 'Slice order on a pie follows data order; use a `transform sort` on the data instead.' },
    sortMode: { applicable: false, implemented: false, note: 'sortMode applies to grouped/stacked charts, not pie.' },
    colorize: { applicable: true, implemented: false, note: 'Per-slice colorize is not yet honored by the pie renderer; use `colorPalette` or `colors`.' },
    valueLabels: { applicable: false, implemented: false, note: 'Pie shows slice labels; use `tooltips` / `displayAsPercentage` instead of valueLabels.' },
  },
  // Single-series line/area have a single path with nothing to dim. `highlight`
  // dims OTHER series/categories, so it is inapplicable here (it does work on
  // line-multi / area-stacked, which default to supported).
  line: {
    highlight: { applicable: false, implemented: false, note: 'highlight dims other series/categories; a single-series line has nothing to dim. Use an `annotation` to call out a point, or `line-multi` for multiple series.' },
  },
  area: {
    highlight: { applicable: false, implemented: false, note: 'highlight dims other series/categories; a single-series area has nothing to dim. Use an `annotation` to call out a point, or `area-stacked` for multiple series.' },
  },
}

export function lookupCapability(chartType: string, key: string): CapabilityCell {
  return OVERRIDES[chartType]?.[key] ?? SUPPORTED
}
