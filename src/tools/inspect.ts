import { z } from 'zod'
import { astToDefinition, type ChartNode, type SceneNode } from '@blueprint-chart/lib'
import { parseDsl } from '../parse'
import { toolOk, type ToolResult } from '../errors'

export const InspectInputSchema = z.object({
  source: z.string(),
})
export type InspectInput = z.infer<typeof InspectInputSchema>

export interface SceneSummary {
  index: number
  name?: string
  hasTransition: boolean
}

export interface InspectOutput {
  chartType: string
  scenes: SceneSummary[]
  hasAnnotations: boolean
  hasColorizes: boolean
  hasHighlights: boolean
  hasAreaFills: boolean
  seriesCount: number
  rowCount: number
}

function summarizeScenes(ast: ChartNode): SceneSummary[] {
  const scenes = (ast.scenes ?? []) as SceneNode[]
  if (scenes.length === 0) {
    return [{ index: 0, hasTransition: false }]
  }
  return scenes.map((scene, i) => ({
    index: i,
    name: scene.name ?? undefined,
    // SceneNode has no explicit `transition` field; transforms power animated
    // transitions in the lib, so non-empty transforms imply a transition.
    hasTransition: (scene.transforms?.length ?? 0) > 0,
  }))
}

export function inspectDsl(input: InspectInput): ToolResult<InspectOutput> {
  const parsed = parseDsl(input.source)
  if (!parsed.ok) {
    return parsed
  }
  const def = astToDefinition(parsed.data.ast)
  return toolOk({
    chartType: def.chartType,
    scenes: summarizeScenes(parsed.data.ast),
    hasAnnotations: (def.annotations?.length ?? 0) > 0,
    hasColorizes: (def.colorizes?.length ?? 0) > 0,
    hasHighlights: (def.highlights?.length ?? 0) > 0,
    hasAreaFills: (def.areaFills?.length ?? 0) > 0,
    seriesCount: def.data.series?.length ?? 0,
    rowCount: def.data.labels?.length ?? 0,
  })
}
