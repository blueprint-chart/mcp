import { afterEach, describe, expect, it } from 'vitest'
import { listChartTypes } from './listChartTypes'

describe('list_chart_types', () => {
  afterEach(() => {
    delete process.env.BLUEPRINT_CHART_DOCS_URL
  })

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

  it('omits docsUrl when docs base is unset', () => {
    const result = listChartTypes()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.chartTypes[0]?.docsUrl).toBeUndefined()
    }
  })

  it('includes docsUrl per entry when docs base is set', () => {
    process.env.BLUEPRINT_CHART_DOCS_URL = 'https://docs.blueprintchart.com'
    const result = listChartTypes()
    expect(result.ok).toBe(true)
    if (result.ok) {
      const entry = result.data.chartTypes[0]
      expect(entry?.docsUrl).toBe(`https://docs.blueprintchart.com/charts/${entry?.name}`)
    }
  })
})
