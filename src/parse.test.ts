import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { parseDsl } from './parse'

describe('parseDsl', () => {
  it('parses a real lib sample', () => {
    const r = parseDsl(samples[0]!.dsl)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.ast).toBeDefined()
    }
  })

  it('returns E_PARSE with line + column for a syntax error', () => {
    const r = parseDsl('chart bogus\n  garbage at line 2')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_PARSE')
      expect(r.errors[0]).toHaveProperty('line')
      expect(r.errors[0]).toHaveProperty('column')
      expect(typeof r.errors[0]!.message).toBe('string')
    }
  })

  it('humanizes the parser message (YAML-colon case flows through parse.ts)', () => {
    const r = parseDsl('chart: donut { data { "A" = 1 } }')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_PARSE')
      expect(r.errors[0]!.message).toContain('chart <type> {')
    }
  })

  it('returns E_INPUT for non-string input', () => {
    const r = parseDsl(123)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })
})
