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

  it('recommends a part-to-whole chart when the goal says "share of total"', () => {
    const r = recommendChartType({ columnTypes: ['string', 'number'], rowCount: 5, goal: 'each region as a share of the total' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(['pie', 'donut']).toContain(r.data.recommendations[0]?.chartType)
    }
  })

  it('surfaces bar-split for a range goal over a low/high column pair', () => {
    const r = recommendChartType({ columnTypes: ['string', 'number', 'number'], rowCount: 6, goal: 'the lead with its margin of error' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.recommendations[0]?.chartType).toBe('bar-split')
    }
  })

  it('keeps bar-split off a range goal that has only one numeric column', () => {
    const r = recommendChartType({ columnTypes: ['string', 'number'], rowCount: 6, goal: 'the lead with its margin of error' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.recommendations.map(x => x.chartType)).not.toContain('bar-split')
    }
  })

  it('puts line-multi first for a categorical crossover goal (2026-06-04 re-cut posture)', () => {
    const r = recommendChartType({
      columnTypes: ['string', 'number', 'number', 'number'],
      rowCount: 6,
      goal: 'software overtakes hardware as the top revenue driver',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const types = r.data.recommendations.map(x => x.chartType)
      const lineMulti = types.indexOf('line-multi')
      const barMulti = types.indexOf('bar-multi')
      expect(lineMulti).toBe(0)
      expect(barMulti).toBeGreaterThan(0)
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

  it('returns guidance naming the top type and the describe_chart_type next step', () => {
    const r = recommendChartType({ columnTypes: ['date', 'number', 'number'], rowCount: 24, goal: 'the energy mix composition over time' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const top = r.data.recommendations[0]!.chartType
      expect(r.data.guidance).toContain(`Use '${top}'`)
      expect(r.data.guidance).toContain(`describe_chart_type({ name: '${top}' })`)
      expect(r.data.guidance).toMatch(/Restraint:/)
      expect(r.data.guidance).not.toMatch(/pass the user's goal/i)
    }
  })

  it('leads the guidance with the pass-the-goal tip when no goal is given', () => {
    const r = recommendChartType({ columnTypes: ['string', 'number'], rowCount: 6 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.guidance).toMatch(/^Tip: pass the user's goal verbatim as 'goal'/)
      expect(r.data.guidance).toContain('composition-over-time')
    }
  })

  it('omits guidance when there are no recommendations', () => {
    const r = recommendChartType({ columnTypes: [], rowCount: 0 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.recommendations).toEqual([])
      expect(r.data.guidance).toBeUndefined()
    }
  })
})
