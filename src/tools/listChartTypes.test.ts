import { describe, expect, it } from 'vitest'
import { listChartTypes } from './listChartTypes'

describe('list_chart_types', () => {
  it('returns canonical chart types with aliases and a summary', () => {
    const r = listChartTypes()
    expect(r.ok).toBe(true)
    if (r.ok) {
      const types = r.data.chartTypes
      expect(types.length).toBeGreaterThan(5)
      const horiz = types.find(t => t.name === 'bar-horizontal')
      expect(horiz).toBeDefined()
      expect(horiz!.aliases).toContain('horizontal-bar')
      expect(horiz!.summary.length).toBeGreaterThan(0)
    }
  })

  it('does not include alias names as canonical entries', () => {
    const r = listChartTypes()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.chartTypes.find(t => t.name === 'horizontal-bar')).toBeUndefined()
    }
  })
})
