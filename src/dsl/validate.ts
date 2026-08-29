import type { ChartNode } from '@blueprint-chart/lib'
import { validateChart } from '@blueprint-chart/lib'
import { isKnownChartType, listCanonicalChartTypes } from './chartTypes'
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

  // Property keys (only meaningful when the chart type is known). The library
  // owns the allowlist: its per-type option defs plus the frame keys it reads
  // directly. Mirroring that set here is what let the MCP reject valid keys
  // and accept keys the library does not have.
  if (chartTypeKnown) {
    for (const issue of validateChart(ast).errors) {
      if (issue.code !== 'unknown-property') {
        continue
      }
      issues.push({
        code: 'E_UNKNOWN_PROPERTY',
        path: issue.path,
        ...(issue.suggestion !== undefined && { suggestion: issue.suggestion }),
        message: issue.message,
        context: { got: issue.path.slice(issue.path.lastIndexOf('.') + 1), chartType },
      })
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
      // The `series` meta-row names columns, not a row label. A quoted
      // `"series"` row is a real data category, so only skip the meta-row.
      if (entry.key === 'series' && !entry.quotedKey) {
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
