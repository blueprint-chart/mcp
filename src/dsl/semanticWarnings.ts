import type { ChartNode } from '@blueprint-chart/lib'
import type { ValidationIssue } from './validate'
import { canonicalChartType } from './chartTypes'
import { lookupCapability, statusOf } from './capabilityMatrix'

// ValidationIssue.code is a strict union of error codes; our warning codes are
// new string literals. We use a local alias that widens `code` to `string` so
// TS accepts our warning objects while consumers still get the full interface.
type WarningIssue = Omit<ValidationIssue, 'code'> & { code: string }

// Chart types that REQUIRE multiple series to be meaningful.
const MULTI_SERIES_TYPES = new Set([
  'bar-multi',
  'bar-grouped',
  'bar-stacked',
  'bar-split',
  'column-stacked',
  'line-multi',
  'area-stacked',
])

function checkKey(type: string, key: string, path: string): WarningIssue | undefined {
  const cell = lookupCapability(type, key)
  const status = statusOf(cell)
  if (status === 'inapplicable') {
    return {
      code: 'W_NO_EFFECT',
      path,
      message: `"${key}" has no effect on a ${type} chart.${cell.note ? ' ' + cell.note : ''}`,
    }
  }
  if (status === 'not-implemented') {
    return {
      code: 'W_NOT_IMPLEMENTED',
      path,
      message: `"${key}" is not yet honored by the ${type} renderer.${cell.note ? ' ' + cell.note : ''}`,
    }
  }
  return undefined
}

export function collectWarnings(ast: ChartNode): WarningIssue[] {
  const issues: WarningIssue[] = []
  const type = canonicalChartType(ast.chartType) ?? ast.chartType

  for (const prop of ast.properties ?? []) {
    const issue = checkKey(type, prop.key, `chart.${prop.key}`)
    if (issue) {
      issues.push(issue)
    }
  }

  if ((ast.colorizes ?? []).some(c => c.fromHighlight !== true)) {
    const issue = checkKey(type, 'colorize', 'chart.colorize')
    if (issue) {
      issues.push(issue)
    }
  }
  if ((ast.highlights?.length ?? 0) > 0 || (ast.colorizes ?? []).some(c => c.fromHighlight === true)) {
    const issue = checkKey(type, 'highlight', 'chart.highlight')
    if (issue) {
      issues.push(issue)
    }
  }

  if (MULTI_SERIES_TYPES.has(type)) {
    const entries = ast.data?.entries ?? []
    const hasSeriesHeader = entries.some(e => e.key === '_series')
    const hasMultiValueRow = entries.some(e => (e.values?.length ?? 0) > 1)
    if (!hasSeriesHeader && !hasMultiValueRow && entries.length > 0) {
      issues.push({
        code: 'W_MULTISERIES_SHAPE',
        path: 'data',
        message: `A ${type} chart needs multiple series, but the data parsed as single-value rows with no \`_series\` header. Add a \`_series = "A","B",…\` row and comma-separated values per row (e.g. \`"USA" = 40,44,42\`).`,
      })
    }
  }

  return issues
}
