import { z } from 'zod'
import { astToDefinition } from '@blueprint-chart/lib'
import type { ChartNode, ColorizeNode, SceneNode } from '@blueprint-chart/lib'
import { parseDsl } from '../parse'
import { toolOk, type ToolResult } from '../errors'
import { looksLikeQuotedLabel } from '../dsl/dataKey'

export const InspectInputSchema = z.object({
  source: z.string(),
})
export type InspectInput = z.infer<typeof InspectInputSchema>

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
  const seriesEntry = entries.find(e => e.key === '_series')
  const seriesNames = seriesEntry
    ? String(seriesEntry.value).split(',').map(s => s.trim().replace(/^"|"$/g, ''))
    : []
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
  // Grammar: `highlight "X" { … }` parses as ColorizeNode with fromHighlight:true,
  // `highlight "X"` (no braces) parses as HighlightNode. Count both.
  const fromHighlightColorizes = (ast.colorizes ?? []).filter(
    (c: ColorizeNode) => c.fromHighlight === true,
  ).length
  return (ast.highlights?.length ?? 0) + fromHighlightColorizes
}

function countNonHighlightColorizes(ast: ChartNode): number {
  return (ast.colorizes ?? []).filter(
    (c: ColorizeNode) => c.fromHighlight !== true,
  ).length
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
