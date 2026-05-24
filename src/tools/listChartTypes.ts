import { z } from 'zod'
import { getDoc, listDocs } from '@blueprint-chart/docs'
import { aliasesFor, listCanonicalChartTypes } from '../dsl/chartTypes'
import { toolOk, type ToolResult } from '../errors'

export const ListChartTypesInputSchema = z.object({}).strict()
export type ListChartTypesInput = z.infer<typeof ListChartTypesInputSchema>

export interface ChartTypeListEntry {
  name: string
  aliases: string[]
  summary: string
}

export interface ListChartTypesOutput {
  chartTypes: ChartTypeListEntry[]
}

function summaryFor(name: string): string {
  // The chart-type docs follow a consistent template: an H1 followed by a
  // blockquote subtitle. Example (`bar-horizontal.md`):
  //   # Horizontal bar chart
  //
  //   > Single-series horizontal bar chart for long category labels and ranked bars.
  // If the doc is missing or the template doesn't match, return ''.
  const entries = listDocs('charts')
  const entry = entries.find(e => e.slug === name)
  if (!entry) {
    return ''
  }
  try {
    const { content } = getDoc('charts', name)
    const match = content.match(/^>\s*(.+)$/m)
    return match?.[1]?.trim() ?? ''
  }
  catch {
    return ''
  }
}

export function listChartTypes(): ToolResult<ListChartTypesOutput> {
  const chartTypes = listCanonicalChartTypes().map(name => ({
    name,
    aliases: aliasesFor(name),
    summary: summaryFor(name),
  }))
  return toolOk({ chartTypes })
}
