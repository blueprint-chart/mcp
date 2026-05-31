import type { ChartRecommendation } from '@blueprint-chart/lib'

/**
 * Goal keyword → chart types that goal favours. Used as a STABLE re-ranking
 * layer ON TOP of lib's column-type/row-count ranking: matched types get a
 * boost, ties preserve lib's original order. lib's `recommendCharts` ignores
 * the goal string entirely (recommend.ts previously dropped it), which caused
 * the 0%-type-match failures on co2-emissions, coffee-production,
 * quarterly-revenue, and election-polls in the usability test.
 */
const GOAL_RULES: ReadonlyArray<{ pattern: RegExp, types: string[] }> = [
  { pattern: /\b(share|part[- ]to[- ]whole|proportion|percentage of (the )?total|breakdown|make up)\b/i, types: ['pie', 'donut', 'bar-stacked', 'column-stacked'] },
  { pattern: /(?:\b(?:composition|mix|stacked).*(?:over time|by year|trend)|\b(?:over time|by year).*(?:composition|mix))\b/i, types: ['area-stacked', 'column-stacked'] },
  { pattern: /\b(over time|trend|grew|rose|fell|climbed|change over|year[- ]over[- ]year)\b/i, types: ['line', 'line-multi', 'area'] },
  { pattern: /\b(overtak\w*|overtook|crossover|surpass|cross over|catch[- ]up|diverg\w*)/i, types: ['line-multi', 'line'] },
  { pattern: /\b(rank|ranked|more than|compared|top \d+|most|largest|biggest)\b/i, types: ['bar-vertical', 'bar-horizontal'] },
  { pattern: /\b(range|high and low|high\/low|margin of error|confidence|interval|plus or minus)\b/i, types: ['bar-split'] },
]

export function applyGoalReranking(
  recs: ChartRecommendation[],
  goal: string | undefined,
): ChartRecommendation[] {
  if (!goal || goal.trim() === '') {
    return recs
  }
  const boost = new Set<string>()
  for (const rule of GOAL_RULES) {
    if (rule.pattern.test(goal)) {
      for (const t of rule.types) {
        boost.add(t)
      }
    }
  }
  if (boost.size === 0) {
    return recs
  }
  return recs
    .map((rec, index) => ({ rec, index, boosted: boost.has(rec.chartType) }))
    // boosted types first; within each group preserve lib's original order
    .sort((a, b) => (a.boosted === b.boosted ? a.index - b.index : a.boosted ? -1 : 1))
    .map(x => x.rec)
}
