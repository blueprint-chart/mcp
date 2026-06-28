import { z } from 'zod'
import { recommendCharts, type ChartRecommendation } from '@blueprint-chart/lib'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'
import { ChartRecommendationSchema } from './outputSchemas'

const ColumnTypeSchema = z.enum(['string', 'number', 'date'])

export const RecommendInputSchema = z.object({
  columnTypes: z.array(ColumnTypeSchema).describe('The type of each data column, in order: "string", "number", or "date".'),
  rowCount: z.number().int().nonnegative().describe('Number of data rows in the dataset.'),
  goal: z.string().optional().describe('Optional prose sentence describing what the chart should show. Determines the chart family (comparison / ranking / part-to-whole / composition-over-time / trend / range).'),
})
export type RecommendInput = z.infer<typeof RecommendInputSchema>

export const RecommendOutputSchema = z.object({
  recommendations: z.array(ChartRecommendationSchema).describe('Ranked chart-type recommendations, best first.'),
  guidance: z.string().optional().describe('Prose next-step guidance for the top recommendation.'),
})

export interface RecommendOutput {
  recommendations: ChartRecommendation[]
  guidance?: string
}

const RESTRAINT_NOTE
  = 'Restraint: add valueLabels/legend/sort/colorPalette/highlight only if the user asked or the finding demands it; always include source/byline metadata.'

const GOAL_TIP
  = 'Tip: pass the user\'s goal verbatim as \'goal\' — do not paraphrase; it determines the chart family (comparison/ranking/part-to-whole/composition-over-time/trend/range).'

function buildGuidance(recommendations: ChartRecommendation[], goal: string | undefined): string | undefined {
  const top = recommendations[0]
  if (!top) {
    return undefined
  }
  const core = `Use '${top.chartType}' unless the user asked for a different type or your reading of the data clearly contradicts it (say why if you override). Next: describe_chart_type({ name: '${top.chartType}' }). ${RESTRAINT_NOTE}`
  if (goal === undefined || goal.trim() === '') {
    return `${GOAL_TIP} ${core}`
  }
  return core
}

export function recommendChartType(input: unknown): ToolResult<RecommendOutput> {
  const parsed = RecommendInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const recommendations = recommendCharts(
    parsed.data.columnTypes,
    parsed.data.rowCount,
    parsed.data.goal,
  )
  const guidance = buildGuidance(recommendations, parsed.data.goal)
  return toolOk(guidance === undefined ? { recommendations } : { recommendations, guidance })
}
