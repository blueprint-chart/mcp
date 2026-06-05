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

// lib 0.1.30's validateChart adds value-level checks the MCP's structural pass
// does not cover. These must now surface through the MCP validate path.
describe('validate_dsl — lib value-level checks', () => {
  it('flags a non-boolean value (tooltips = yes) as invalid-boolean', () => {
    const r = validateDsl({ source: 'chart bar-vertical {\n  tooltips = yes\n  data { "A" = 1 }\n}' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.valid).toBe(false)
      expect(r.data.errors.some(e => e.code === 'invalid-boolean')).toBe(true)
    }
  })

  it('flags an out-of-set choice (lineSymbolShape = "diamondd") as invalid-choice', () => {
    const r = validateDsl({ source: 'chart line-multi {\n  lineSymbolShape = "diamondd"\n  data {\n    series = "X","Y"\n    "A" = 1,2\n  }\n}' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.valid).toBe(false)
      const issue = r.data.errors.find(e => e.code === 'invalid-choice')
      expect(issue).toBeDefined()
      expect(issue!.suggestion).toBe('diamond')
    }
  })

  it('flags an unknown transform type as unknown-transform', () => {
    const r = validateDsl({ source: 'chart bar-vertical {\n  data { "A" = 1 }\n  transform bogus { }\n}' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.valid).toBe(false)
      expect(r.data.errors.some(e => e.code === 'unknown-transform')).toBe(true)
    }
  })

  it('flags an unknown range annotation property (fromX) as unknown-annotation-property', () => {
    const r = validateDsl({ source: 'chart line {\n  data {\n    "A" = 1\n    "B" = 2\n  }\n  range { fromX = 1 }\n}' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.valid).toBe(false)
      expect(r.data.errors.some(e => e.code === 'unknown-annotation-property')).toBe(true)
    }
  })
})
