import { describe, expect, it } from 'vitest'
import { getGrammar } from './getGrammar'

describe('get_grammar', () => {
  it('returns the full grammar by default', () => {
    const r = getGrammar({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.section).toBe('all')
      expect(r.data.text.length).toBeGreaterThan(100)
    }
  })

  it('returns a single section when requested', () => {
    const r = getGrammar({ section: 'properties' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.section).toBe('properties')
      expect(r.data.text.toLowerCase()).toContain('properties')
    }
  })

  it('errors with E_INPUT for an unknown section', () => {
    const r = getGrammar({ section: 'totally-made-up' } as unknown)
    expect(r.ok).toBe(false)
  })
})
