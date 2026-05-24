import { listCharts } from '@blueprint-chart/lib'

/**
 * Maps alias chart-type names to canonical names. Lib registers aliases
 * (`horizontal-bar` → `bar-horizontal`, `vertical-bar` → `bar-vertical`) at
 * the registry level so both render identically; we surface that mapping here
 * so validation and discovery tools can normalize input.
 *
 * Static rather than derived from the registry because the registry doesn't
 * track alias→canonical pairs — it just registers each alias as a duplicate
 * entry. Source of truth: `packages/lib/src/charts/registry.ts:445-446` and
 * `packages/lib/src/enums.ts:24-25`.
 */
export const CHART_TYPE_ALIASES: Record<string, string> = {
  'horizontal-bar': 'bar-horizontal',
  'vertical-bar': 'bar-vertical',
}

const ALIAS_NAMES = new Set(Object.keys(CHART_TYPE_ALIASES))

export function listCanonicalChartTypes(): string[] {
  return listCharts().filter(name => !ALIAS_NAMES.has(name))
}

export function canonicalChartType(name: string): string | undefined {
  if (CHART_TYPE_ALIASES[name]) {
    return CHART_TYPE_ALIASES[name]
  }
  if (listCharts().includes(name)) {
    return name
  }
  return undefined
}

export function isKnownChartType(name: string): boolean {
  return canonicalChartType(name) !== undefined
}

export function aliasesFor(canonical: string): string[] {
  return Object.entries(CHART_TYPE_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias)
}
