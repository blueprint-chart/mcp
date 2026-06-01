import type { ChartRecommendation } from '@blueprint-chart/lib'

/**
 * Goal keyword → chart types that goal favours, classified `strong` or `weak`.
 *
 * STRONG rules name a goal that implies a different chart *family* (part-to-whole,
 * composition-over-time, range) and so may override lib's column-type "best".
 * WEAK rules are narrative framings (trend, crossover, rank) that only break ties
 * among non-best candidates — they must NOT demote lib's structurally-best pick.
 * (Without this distinction the "overtakes" keyword wrongly boosted line-multi
 * above the correct bar-multi for quarterly-revenue.)
 *
 * Used as a re-ranking layer ON TOP of lib's column-type/row-count ranking;
 * lib's `recommendCharts` ignores the goal string entirely.
 */
const GOAL_RULES: ReadonlyArray<{ pattern: RegExp, types: string[], strong: boolean }> = [
  { pattern: /\b(share|part[- ]to[- ]whole|proportion|percentage of (the )?total|breakdown|make up)\b/i, types: ['pie', 'donut', 'bar-stacked', 'column-stacked'], strong: true },
  { pattern: /(?:\b(?:composition|mix|stacked).*(?:over time|by year|trend)|\b(?:over time|by year).*(?:composition|mix))\b/i, types: ['area-stacked', 'column-stacked'], strong: true },
  { pattern: /\b(over time|trend|grew|rose|fell|climbed|change over|year[- ]over[- ]year)\b/i, types: ['line', 'line-multi', 'area'], strong: false },
  { pattern: /\b(overtak\w*|overtook|crossover|surpass|cross over|catch[- ]up|diverg\w*)/i, types: ['line-multi', 'line'], strong: false },
  { pattern: /\b(rank|ranked|more than|compared|top \d+|most|largest|biggest)\b/i, types: ['bar-vertical', 'bar-horizontal'], strong: false },
  { pattern: /\b(range|high and low|high\/low|margin of error|confidence|interval|plus or minus)\b/i, types: ['bar-split'], strong: true },
]

/**
 * Re-rank lib's recommendations using the goal string. Returns a new array;
 * never mutates the input. `rowCount` (when provided) enables a pie-before-donut
 * tiebreak for very small slice counts.
 */
export function applyGoalReranking(
  recs: ChartRecommendation[],
  goal: string | undefined,
  rowCount?: number,
): ChartRecommendation[] {
  if (!goal || goal.trim() === '') {
    return recs
  }

  const strongBoost = new Set<string>()
  const weakBoost = new Set<string>()
  for (const rule of GOAL_RULES) {
    if (rule.pattern.test(goal)) {
      const target = rule.strong ? strongBoost : weakBoost
      for (const t of rule.types) {
        target.add(t)
      }
    }
  }

  // No-match contract: if nothing matched, return unchanged WITHOUT running the
  // tier sort — otherwise tier 1 (lib "best") would float ahead of a lib-higher
  // "good" even when the author gave no usable goal.
  if (strongBoost.size === 0 && weakBoost.size === 0) {
    return recs
  }

  // Tier: strong-boosted (0) → lib "best" (1) → weak-boosted (2) → rest (3).
  const tierOf = (rec: ChartRecommendation): number => {
    if (strongBoost.has(rec.chartType)) {
      return 0
    }
    if (rec.fitness === 'best') {
      return 1
    }
    if (weakBoost.has(rec.chartType)) {
      return 2
    }
    return 3
  }

  const sorted = recs
    .map((rec, index) => ({ rec, index, tier: tierOf(rec) }))
    // tier ascending; within a tier preserve lib's original order (stable)
    .sort((a, b) => (a.tier === b.tier ? a.index - b.index : a.tier - b.tier))
    .map(x => x.rec)

  // Pie suits very small N; for ≤5 slices prefer pie over donut when both are
  // present (and pie currently trails donut). Larger N keeps lib's donut order.
  if (rowCount !== undefined && rowCount <= 5) {
    const donutIdx = sorted.findIndex(r => r.chartType === 'donut')
    const pieIdx = sorted.findIndex(r => r.chartType === 'pie')
    if (donutIdx !== -1 && pieIdx !== -1 && pieIdx > donutIdx) {
      const [pieRec] = sorted.splice(pieIdx, 1)
      sorted.splice(donutIdx, 0, pieRec!)
    }
  }

  return sorted
}
