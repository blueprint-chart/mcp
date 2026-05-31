import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { validateDsl } from './validate'

describe('validate_dsl', () => {
  it('returns valid: true with empty errors/warnings for every sample', () => {
    for (const s of samples) {
      const r = validateDsl({ source: s.dsl })
      expect(r.ok, `sample ${s.id}`).toBe(true)
      if (r.ok) {
        expect(r.data.valid).toBe(true)
        expect(r.data.errors).toEqual([])
        expect(r.data.warnings).toEqual([])
      }
    }
  })

  it('returns valid: false with E_UNKNOWN_CHART_TYPE on chart bar', () => {
    const r = validateDsl({ source: 'chart bar { data { "E" = 1 } }' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.valid).toBe(false)
      expect(r.data.errors[0]!.code).toBe('E_UNKNOWN_CHART_TYPE')
      expect(r.data.errors[0]!.suggestion).toMatch(/^bar-/)
    }
  })

  it('still surfaces PEG errors as E_PARSE (isError channel)', () => {
    const r = validateDsl({ source: '@@@ not valid' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_PARSE')
    }
  })
})

describe('validate_dsl warnings', () => {
  it('stays valid but surfaces a no-op warning for sort on donut', () => {
    const r = validateDsl({ source: 'chart donut {\n  sort = descending\n  data { "A" = 1 }\n}' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.valid).toBe(true)
      expect(r.data.warnings.some(w => w.code === 'W_NO_EFFECT')).toBe(true)
    }
  })

  it('emits no warnings for a clean chart', () => {
    const r = validateDsl({ source: 'chart bar-vertical {\n  data { "A" = 1 }\n}' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.warnings).toEqual([])
    }
  })
})
