import { describe, expect, it } from 'vitest'
import { recommendChartType } from './recommend'

describe('recommend_chart_type', () => {
  it('recommends a line chart for 1 date + 1 number', () => {
    const r = recommendChartType({ columnTypes: ['date', 'number'], rowCount: 12 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.recommendations[0]?.chartType).toBe('line')
      expect(r.data.recommendations[0]?.fitness).toBe('best')
    }
  })

  it('returns empty list for empty columns', () => {
    const r = recommendChartType({ columnTypes: [], rowCount: 0 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.recommendations).toEqual([])
    }
  })

  it('rejects unknown column types', () => {
    const r = recommendChartType({ columnTypes: ['unknown'], rowCount: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })

  it('rejects negative row counts', () => {
    const r = recommendChartType({ columnTypes: ['string', 'number'], rowCount: -1 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })

  it('reorders toward part-to-whole when a goal says "share of total"', () => {
    const r = recommendChartType({ columnTypes: ['string', 'number'], rowCount: 5, goal: 'each region as a share of the total' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(['pie', 'donut', 'bar-stacked', 'column-stacked']).toContain(r.data.recommendations[0]?.chartType)
    }
  })

  it('keeps lib-best bar-multi ahead of a narrative-boosted line-multi', () => {
    const r = recommendChartType({
      columnTypes: ['string', 'number', 'number', 'number'],
      rowCount: 6,
      goal: 'software overtakes hardware as the top revenue driver',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const types = r.data.recommendations.map(x => x.chartType)
      const barMulti = types.indexOf('bar-multi')
      const lineMulti = types.indexOf('line-multi')
      expect(barMulti).toBeGreaterThanOrEqual(0)
      expect(lineMulti).toBeGreaterThanOrEqual(0)
      expect(barMulti).toBeLessThan(lineMulti)
    }
  })

  it('threads rowCount so the pie tiebreak fires for a small-N part-to-whole goal', () => {
    const r = recommendChartType({
      columnTypes: ['string', 'number'],
      rowCount: 5,
      goal: 'Asia is nearly 60% of the world population; share of total across five regions',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const types = r.data.recommendations.map(x => x.chartType)
      const pieIdx = types.indexOf('pie')
      const donutIdx = types.indexOf('donut')
      // both should be present and boosted to the front; pie before donut at N=5
      expect(pieIdx).toBeGreaterThanOrEqual(0)
      expect(donutIdx).toBeGreaterThanOrEqual(0)
      expect(pieIdx).toBeLessThan(donutIdx)
    }
  })
})
