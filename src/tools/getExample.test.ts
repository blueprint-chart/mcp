import { describe, expect, it } from 'vitest'
import { getExample } from './getExample'

describe('get_example', () => {
  it('returns the starter sample when no args', () => {
    const r = getExample({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.id).toBe('letter-frequency')
      expect(r.data.dsl).toContain('chart bar-vertical')
    }
  })

  it('returns a sample by id', () => {
    const r = getExample({ name: 'letter-frequency' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.chartType).toBe('bar-vertical')
    }
  })

  it('returns the first matching sample for a chartType', () => {
    const r = getExample({ chartType: 'bar-horizontal' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.chartType).toBe('bar-horizontal')
    }
  })

  it('errors with E_INPUT for an unknown id', () => {
    const r = getExample({ name: 'made-up-sample' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })

  it('errors with E_INPUT for an unknown chart type', () => {
    const r = getExample({ chartType: 'bar' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })
})
