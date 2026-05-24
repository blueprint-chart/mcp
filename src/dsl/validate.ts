import type { ChartNode } from '@blueprint-chart/lib'
import { isKnownChartType, listCanonicalChartTypes } from './chartTypes'
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

  const dataEntries = ast.data?.entries ?? []
  if (dataEntries.length === 0) {
    issues.push({
      code: 'E_EMPTY_DATA',
      path: 'data',
      message: 'Chart has no data. Add a `data { … }` block with at least one entry.',
    })
  }

  return issues
}
