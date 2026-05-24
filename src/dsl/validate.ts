import type { ChartNode, PropertyNode } from '@blueprint-chart/lib'
import { getChartOptions } from '@blueprint-chart/lib'
import { canonicalChartType, isKnownChartType, listCanonicalChartTypes } from './chartTypes'
import { UNIVERSAL_PROPERTIES } from './universalProperties'
import { nearestSuggestion } from './suggest'

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

/**
 * Heuristic for "data key is unquoted identifier-shaped." The lib's PropertyNode
 * tagged quoted-string keys via an isQuoted boolean in older grammar versions,
 * but the installed lib (v0.1.19) does not consistently expose it. We fall back
 * to a regex match against the Identifier production from grammar.peggy.
 *
 * The Identifier production is: [a-zA-Z_#][a-zA-Z0-9_#-]*
 *
 * However, since parsed PropertyNode has no isQuoted flag, we cannot distinguish
 * `"China" = 5` from `China = 5` purely from the AST. We tighten the heuristic
 * by only flagging keys that start with a lowercase letter — real data labels in
 * shipped samples always start with an uppercase letter, a digit, or `_`. A
 * camelCase-starting key (e.g. `unquotedKey`) is a strong signal that the user
 * typed a property key as if it were a chart-level option.
 */
function looksLikeUnquotedKey(entry: PropertyNode): boolean {
  const k = entry.key
  const tagged = (entry as unknown as { isQuoted?: boolean }).isQuoted
  if (typeof tagged === 'boolean') {
    return !tagged
  }
  // Only flag identifiers that start with a lowercase letter — proper-noun labels
  // and abbreviations used as data row labels always start with uppercase or `_`.
  return /^[a-z][A-Za-z0-9_#-]*$/.test(k)
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
