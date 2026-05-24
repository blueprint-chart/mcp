import type { ChartNode } from '@blueprint-chart/lib'
import { getChartOptions } from '@blueprint-chart/lib'
import { canonicalChartType, isKnownChartType, listCanonicalChartTypes } from './chartTypes'
import { UNIVERSAL_PROPERTIES } from './universalProperties'
import { nearestSuggestion } from './suggest'
import { looksLikeUnquotedKey } from './dataKey'

export type ValidationCode =
  | 'E_UNKNOWN_CHART_TYPE'
  | 'E_UNKNOWN_PROPERTY'
  | 'E_INVALID_PROPERTY_VALUE'
  | 'E_DUPLICATE_BLOCK'
  | 'E_EMPTY_DATA'
  | 'E_UNKNOWN_DATA_KEY'

export interface ValidationIssue {
  code: ValidationCode
  path: string
  message: string
  suggestion?: string
  context?: Record<string, unknown>
}

function chartLevelKnownKeys(chartType: string): string[] {
  const canonical = canonicalChartType(chartType) ?? chartType
  const perType = getChartOptions(canonical).map(o => o.key)
  return [...UNIVERSAL_PROPERTIES, ...perType]
}

export function validateAst(ast: ChartNode): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const chartType = ast.chartType
  const chartTypeKnown = isKnownChartType(chartType)
  if (!chartTypeKnown) {
    const known = listCanonicalChartTypes()
    issues.push({
      code: 'E_UNKNOWN_CHART_TYPE',
      path: 'chart',
      message: `Unknown chart type "${chartType}". Known types: ${known.join(', ')}.`,
      suggestion: nearestSuggestion(chartType, known),
      context: { got: chartType, known },
    })
  }

  // Chart-level property keys (only meaningful when the chart type is known)
  if (chartTypeKnown) {
    const known = chartLevelKnownKeys(chartType)
    const knownSet = new Set(known)
    for (const prop of ast.properties ?? []) {
      if (!knownSet.has(prop.key)) {
        issues.push({
          code: 'E_UNKNOWN_PROPERTY',
          path: `chart.${prop.key}`,
          message: `Unknown property "${prop.key}" on chart ${chartType}.`,
          suggestion: nearestSuggestion(prop.key, known),
          context: { got: prop.key, chartType },
        })
      }
    }
  }

  // Data block
  const dataEntries = ast.data?.entries ?? []
  if (dataEntries.length === 0) {
    issues.push({
      code: 'E_EMPTY_DATA',
      path: 'data',
      message: 'Chart has no data. Add a `data { … }` block with at least one entry.',
    })
  }
  else {
    for (const entry of dataEntries) {
      // The `_series` pseudo-key is a multi-series header, not a row label.
      if (entry.key === '_series') {
        continue
      }
      if (looksLikeUnquotedKey(entry)) {
        issues.push({
          code: 'E_UNKNOWN_DATA_KEY',
          path: `data.${entry.key}`,
          message: `Data key "${entry.key}" looks like an identifier, but data rows expect quoted string labels (e.g. \`"${entry.key}" = …\`).`,
          context: { got: entry.key },
          suggestion: `"${entry.key}"`,
        })
      }
    }
  }

  return issues
}
