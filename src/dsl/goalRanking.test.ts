import { describe, expect, it } from 'vitest'
import type { ChartRecommendation } from '@blueprint-chart/lib'
import { applyGoalReranking } from './goalRanking'

const recs: ChartRecommendation[] = [
  { chartType: 'bar-vertical', label: 'Bar', fitness: 'best', reason: 'r' },
  { chartType: 'donut', label: 'Donut', fitness: 'good', reason: 'r' },
  { chartType: 'pie', label: 'Pie', fitness: 'alternative', reason: 'r' },
  { chartType: 'area-stacked', label: 'Area stacked', fitness: 'alternative', reason: 'r' },
]

describe('applyGoalReranking', () => {
  it('returns input unchanged when goal is undefined', () => {
    expect(applyGoalReranking(recs, undefined)).toEqual(recs)
  })

  it('promotes part-to-whole types for a "share of total" goal', () => {
    const out = applyGoalReranking(recs, 'show each region as a share of the total population')
    expect(['pie', 'donut']).toContain(out[0]!.chartType)
  })

  it('promotes area-stacked for a "composition over time" goal', () => {
    const out = applyGoalReranking(recs, 'composition of energy sources over time')
    expect(out[0]!.chartType).toBe('area-stacked')
  })

  it('keeps original order when no keyword matches', () => {
    const out = applyGoalReranking(recs, 'just some unrelated text')
    expect(out.map(r => r.chartType)).toEqual(recs.map(r => r.chartType))
  })
})
