import { describe, expect, it } from 'vitest'
import { searchExamples } from './searchExamples'

describe('search_examples', () => {
  it('finds samples by topic keyword in title/description', () => {
    const r = searchExamples({ query: 'population' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.results.length).toBeGreaterThan(0)
      expect(r.data.results[0]).toHaveProperty('id')
      expect(r.data.results[0]).toHaveProperty('chartType')
      expect(r.data.results[0]).not.toHaveProperty('dsl')
    }
  })

  it('filters by chartType', () => {
    const r = searchExamples({ chartType: 'pie' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.results.every(x => x.chartType === 'pie')).toBe(true)
    }
  })

  it('rejects when neither query nor chartType is given', () => {
    const r = searchExamples({})
    expect(r.ok).toBe(false)
  })

  it('rejects an unknown chartType', () => {
    const r = searchExamples({ chartType: 'notachart' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })
})
