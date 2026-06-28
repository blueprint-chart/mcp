import { z } from 'zod'
import { astToDefinition } from '@blueprint-chart/lib'
import type { ChartNode, ColorizeNode, SceneNode } from '@blueprint-chart/lib'
import { parseDsl } from '../parse'
import { toolOk, type ToolResult } from '../errors'
import { looksLikeQuotedLabel } from '../dsl/dataKey'

export const InspectInputSchema = z.object({
  source: z.string().describe('The .bpc chart source to parse and summarize.'),
})
export type InspectInput = z.infer<typeof InspectInputSchema>

const SceneSummarySchema = z.object({
  index: z.number().int().describe('Zero-based scene index.'),
  name: z.string().optional().describe('Scene name, if named.'),
  hasTransition: z.boolean().describe('Whether the scene defines transforms.'),
})
const DataSummarySchema = z.object({
  rowCount: z.number().int().describe('Number of data rows.'),
  entryCount: z.number().int().describe('Total data-block entries (rows plus directives like series).'),
  labels: z.array(z.string()).describe('Row labels in source order.'),
  seriesNames: z.array(z.string()).describe('Series names for multi-series charts.'),
  multiSeries: z.boolean().describe('True when the data declares multiple series.'),
})
export const InspectOutputSchema = z.object({
  chartType: z.string().describe('Declared chart type.'),
  scenes: z.array(SceneSummarySchema).describe('Per-scene summaries (always at least one).'),
  data: DataSummarySchema.describe('Summary of the data block.'),
  hasAnnotations: z.boolean().describe('Whether any annotation/range/note is present.'),
  hasColorizes: z.boolean().describe('Whether any non-highlight colorize is present.'),
  hasHighlights: z.boolean().describe('Whether any highlight is present.'),
  hasAreaFills: z.boolean().describe('Whether any area-fill is present.'),
  seriesCount: z.number().int().describe('Number of series.'),
})

export interface SceneSummary {
  index: number
  name?: string
  hasTransition: boolean
}

export interface DataSummary {
  rowCount: number
  entryCount: number
  labels: string[]
  seriesNames: string[]
  multiSeries: boolean
}

export interface InspectOutput {
  chartType: string
  scenes: SceneSummary[]
  data: DataSummary
  hasAnnotations: boolean
  hasColorizes: boolean
  hasHighlights: boolean
  hasAreaFills: boolean
  seriesCount: number
}

function summarizeScenes(ast: ChartNode): SceneSummary[] {
  const scenes = (ast.scenes ?? []) as SceneNode[]
  if (scenes.length === 0) {
    return [{ index: 0, hasTransition: false }]
  }
  return scenes.map((scene, i) => ({
    index: i,
    name: scene.name ?? undefined,
    hasTransition: (scene.transforms?.length ?? 0) > 0,
  }))
}

function summarizeData(ast: ChartNode): DataSummary {
  const entries = ast.data?.entries ?? []
  const seriesEntry = entries.find(e => e.key === 'series' && !e.quotedKey)
  const seriesValues = seriesEntry
    ? (seriesEntry.values ?? [seriesEntry.value])
    : []
  const seriesNames = seriesValues.map(v => String(v).trim().replace(/^"|"$/g, ''))
  const rowEntries = entries.filter(looksLikeQuotedLabel)
  return {
    rowCount: rowEntries.length,
    entryCount: entries.length,
    labels: rowEntries.map(e => e.key.replace(/^"|"$/g, '')),
    seriesNames,
    multiSeries: seriesNames.length > 0,
  }
}

function countHighlights(ast: ChartNode): number {
  // `highlight "X" { … }` parses as ColorizeNode with fromHighlight:true,
  // `highlight "X"` (no braces) parses as HighlightNode. Count both, at the
  // chart level AND inside every scene (scenes carry their own highlights).
  // unknown[]: only .length is read, so element type is irrelevant here
  const countIn = (node: { highlights?: unknown[], colorizes?: ColorizeNode[] }): number => {
    const fromHighlightColorizes = (node.colorizes ?? []).filter(c => c.fromHighlight === true).length
    return (node.highlights?.length ?? 0) + fromHighlightColorizes
  }
  const sceneTotal = (ast.scenes ?? []).reduce((sum, s) => sum + countIn(s), 0)
  return countIn(ast) + sceneTotal
}

function countNonHighlightColorizes(ast: ChartNode): number {
  const countIn = (cs: ColorizeNode[] | undefined): number =>
    (cs ?? []).filter(c => c.fromHighlight !== true).length
  const sceneTotal = (ast.scenes ?? []).reduce((sum, s) => sum + countIn(s.colorizes), 0)
  return countIn(ast.colorizes) + sceneTotal
}

export function inspectDsl(input: InspectInput): ToolResult<InspectOutput> {
  const parsed = parseDsl(input.source)
  if (!parsed.ok) {
    return parsed
  }
  const ast = parsed.data.ast
  const def = astToDefinition(ast)

  return toolOk({
    chartType: def.chartType,
    scenes: summarizeScenes(ast),
    data: summarizeData(ast),
    hasAnnotations: (def.annotations?.length ?? 0) > 0,
    hasColorizes: countNonHighlightColorizes(ast) > 0,
    hasHighlights: countHighlights(ast) > 0,
    hasAreaFills: (def.areaFills?.length ?? 0) > 0,
    seriesCount: def.data.series?.length ?? 0,
  })
}
