import { z } from 'zod'
import { recommendCharts, type ChartRecommendation } from '@blueprint-chart/lib'
import { applyGoalReranking } from '../dsl/goalRanking'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

const ColumnTypeSchema = z.enum(['string', 'number', 'date'])

export const RecommendInputSchema = z.object({
  columnTypes: z.array(ColumnTypeSchema),
  rowCount: z.number().int().nonnegative(),
  goal: z.string().optional(),
})
export type RecommendInput = z.infer<typeof RecommendInputSchema>

export interface RecommendOutput {
  recommendations: ChartRecommendation[]
}

export function recommendChartType(input: unknown): ToolResult<RecommendOutput> {
  const parsed = RecommendInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const base = recommendCharts(parsed.data.columnTypes, parsed.data.rowCount)
  const recommendations = applyGoalReranking(base, parsed.data.goal, parsed.data.rowCount)
  return toolOk({ recommendations })
}
