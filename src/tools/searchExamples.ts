import { z } from 'zod'
import { samples } from '@blueprint-chart/lib'
import { canonicalChartType } from '../dsl/chartTypes'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

export const SearchExamplesInputSchema = z.object({
  query: z.string().optional(),
  chartType: z.string().optional(),
  limit: z.number().int().positive().max(20).optional(),
}).strict()
export type SearchExamplesInput = z.infer<typeof SearchExamplesInputSchema>

export interface SearchExampleHit {
  id: string
  title: string
  description: string
  chartType: string
  /** Raw count of query terms matched in title+description; used only for ordering. */
  score: number
}

export interface SearchExamplesOutput {
  results: SearchExampleHit[]
}

function scoreSample(s: { title: string, description: string }, terms: string[]): number {
  if (terms.length === 0) {
    return 1
  }
  const hay = `${s.title} ${s.description}`.toLowerCase()
  let score = 0
  for (const t of terms) {
    if (hay.includes(t)) {
      score += 1
    }
  }
  return score
}

export function searchExamples(input: unknown): ToolResult<SearchExamplesOutput> {
  const parsed = SearchExamplesInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const { query, chartType, limit } = parsed.data
  if ((!query || query.trim() === '') && !chartType) {
    return toolError(ErrorCode.E_INPUT, [{
      path: 'query',
      message: 'Provide a `query` (topic keywords) and/or a `chartType` to search examples.',
    }])
  }

  let canonical: string | undefined
  if (chartType) {
    canonical = canonicalChartType(chartType)
    if (!canonical) {
      return toolError(ErrorCode.E_INPUT, [{
        code: 'E_UNKNOWN_CHART_TYPE',
        path: 'chartType',
        message: `Unknown chart type "${chartType}".`,
      }])
    }
  }

  const terms = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const results = samples
    .filter(s => (canonical ? s.chartType === canonical : true))
    .map(s => ({ id: s.id, title: s.title, description: s.description, chartType: s.chartType, score: scoreSample(s, terms) }))
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit ?? 10)

  return toolOk({ results })
}
