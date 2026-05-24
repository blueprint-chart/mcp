import { describe, expect, it } from 'vitest'
import { describeChartType } from './describeChartType'

describe('describe_chart_type', () => {
  it('returns properties + summary for bar-horizontal', () => {
    const r = describeChartType({ name: 'bar-horizontal' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.name).toBe('bar-horizontal')
      expect(r.data.aliases).toContain('horizontal-bar')
      expect(r.data.summary.length).toBeGreaterThan(0)
      expect(r.data.properties.length).toBeGreaterThan(0)
      const sort = r.data.properties.find(p => p.key === 'sort')
      expect(sort).toBeDefined()
      expect(sort?.type).toBeDefined()
    }
  })

  it('accepts an alias and normalizes', () => {
    const r = describeChartType({ name: 'horizontal-bar' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.name).toBe('bar-horizontal')
    }
  })

  it('errors with structured suggestion on unknown name', () => {
    const r = describeChartType({ name: 'bar' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_UNKNOWN_CHART_TYPE')
      expect(r.errors[0]!.suggestion).toMatch(/^bar-/)
    }
  })

  it('includes a starter dataShape example', () => {
    const r = describeChartType({ name: 'bar-vertical' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.dataShape.kind).toMatch(/single-series|multi-series/)
      expect(r.data.dataShape.example).toContain('data')
    }
  })
})
