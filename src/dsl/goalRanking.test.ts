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

  it('keeps lib "best" bar-multi ahead of a narrative-boosted line-multi (quarterly-revenue)', () => {
    const r: ChartRecommendation[] = [
      { chartType: 'line-multi', label: 'Multi-Line', fitness: 'good', reason: 'r' },
      { chartType: 'bar-multi', label: 'Grouped Bar', fitness: 'best', reason: 'r' },
    ]
    const out = applyGoalReranking(r, 'software overtakes hardware as the top revenue driver', 6)
    expect(out[0]!.chartType).toBe('bar-multi')
    expect(out[1]!.chartType).toBe('line-multi')
  })

  it('promotes pie ahead of donut for a part-to-whole goal at very small N (world-population)', () => {
    const r: ChartRecommendation[] = [
      { chartType: 'donut', label: 'Donut', fitness: 'good', reason: 'r' },
      { chartType: 'pie', label: 'Pie', fitness: 'alternative', reason: 'r' },
      { chartType: 'bar-vertical', label: 'Bar', fitness: 'best', reason: 'r' },
      { chartType: 'bar-horizontal', label: 'HBar', fitness: 'good', reason: 'r' },
    ]
    const out = applyGoalReranking(r, 'Asia is nearly 60% of the world population; share of total', 5)
    expect(out[0]!.chartType).toBe('pie')
    expect(out.map(x => x.chartType)).toEqual(['pie', 'donut', 'bar-vertical', 'bar-horizontal'])
  })

  it('leaves lib "best" bar-vertical #1 for a ranked-comparison goal (co2-emissions)', () => {
    const r: ChartRecommendation[] = [
      { chartType: 'bar-vertical', label: 'Bar', fitness: 'best', reason: 'r' },
      { chartType: 'bar-horizontal', label: 'HBar', fitness: 'good', reason: 'r' },
      { chartType: 'donut', label: 'Donut', fitness: 'good', reason: 'r' },
      { chartType: 'pie', label: 'Pie', fitness: 'alternative', reason: 'r' },
    ]
    const out = applyGoalReranking(r, 'China emits more than the US and India combined; ranked', 6)
    expect(out.map(x => x.chartType)).toEqual(['bar-vertical', 'bar-horizontal', 'donut', 'pie'])
  })

  it('promotes bar-split to #1 for a range / high-low goal (election-polls)', () => {
    const r: ChartRecommendation[] = [
      { chartType: 'bar-multi', label: 'Grouped Bar', fitness: 'best', reason: 'r' },
      { chartType: 'bar-split', label: 'Split Bar', fitness: 'good', reason: 'r' },
      { chartType: 'line-multi', label: 'Multi-Line', fitness: 'alternative', reason: 'r' },
    ]
    const out = applyGoalReranking(r, 'each party has a high and low estimate; a polling range', 6)
    expect(out[0]!.chartType).toBe('bar-split')
  })

  it('does NOT apply the pie tiebreak for larger N', () => {
    const r: ChartRecommendation[] = [
      { chartType: 'donut', label: 'Donut', fitness: 'good', reason: 'r' },
      { chartType: 'pie', label: 'Pie', fitness: 'alternative', reason: 'r' },
      { chartType: 'bar-vertical', label: 'Bar', fitness: 'best', reason: 'r' },
    ]
    const out = applyGoalReranking(r, 'share of total', 12)
    const di = out.findIndex(x => x.chartType === 'donut')
    const pi = out.findIndex(x => x.chartType === 'pie')
    expect(di).toBeLessThan(pi)
  })

  it('returns input unchanged on no-match WITHOUT floating best ahead of a lib-higher good', () => {
    const r: ChartRecommendation[] = [
      { chartType: 'line-multi', label: 'Multi-Line', fitness: 'good', reason: 'r' },
      { chartType: 'bar-multi', label: 'Grouped Bar', fitness: 'best', reason: 'r' },
    ]
    const out = applyGoalReranking(r, 'just some unrelated text', 6)
    expect(out.map(x => x.chartType)).toEqual(['line-multi', 'bar-multi'])
  })
})
