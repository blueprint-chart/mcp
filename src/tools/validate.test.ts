import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { validateDsl } from './validate'

describe('validate_dsl', () => {
  it('returns ok for every shipped sample', () => {
    for (const s of samples) {
      const r = validateDsl({ source: s.dsl })
      expect(r.ok, `sample "${s.id}" should validate`).toBe(true)
    }
  })

  it('returns parse error with line/column', () => {
    const r = validateDsl({ source: 'chart not-a-real-thing\n@@@' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_PARSE')
      expect(r.errors[0]?.line).toBeTypeOf('number')
    }
  })

  it('returns E_INPUT for non-string source', () => {
    // @ts-expect-error testing runtime validation
    const r = validateDsl({ source: null })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
    }
  })
})
