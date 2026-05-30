import { afterEach, describe, expect, it } from 'vitest'
import { describeChartType } from './describeChartType'

describe('describe_chart_type', () => {
  afterEach(() => {
    delete process.env.BLUEPRINT_CHART_DOCS_URL
  })
  it('returns properties + summary for bar-horizontal', () => {
    const r = describeChartType({ chartType: 'bar-horizontal' })
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
    const r = describeChartType({ chartType: 'horizontal-bar' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.name).toBe('bar-horizontal')
    }
  })

  it('errors with structured suggestion on unknown name', () => {
    const r = describeChartType({ chartType: 'bar' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_UNKNOWN_CHART_TYPE')
      expect(r.errors[0]!.suggestion).toMatch(/^bar-/)
    }
  })

  it('includes a starter dataShape example', () => {
    const r = describeChartType({ chartType: 'bar-vertical' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.dataShape.kind).toMatch(/single-series|multi-series/)
      expect(r.data.dataShape.example).toContain('data')
    }
  })

  it('omits docsUrl when docs base is unset', () => {
    const result = describeChartType({ chartType: 'bar-vertical' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.docsUrl).toBeUndefined()
    }
  })

  it('includes a top-level docsUrl when docs base is set', () => {
    process.env.BLUEPRINT_CHART_DOCS_URL = 'https://docs.blueprintchart.com'
    const result = describeChartType({ chartType: 'bar-vertical' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.docsUrl).toBe('https://docs.blueprintchart.com/charts/bar-vertical')
    }
  })
})
