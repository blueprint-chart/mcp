import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { inspectDsl } from './inspect'

describe('inspect_dsl', () => {
  it('returns chartType + data summary for every sample', () => {
    for (const s of samples) {
      const r = inspectDsl({ source: s.dsl })
      expect(r.ok, `sample ${s.id}`).toBe(true)
      if (r.ok) {
        expect(r.data.chartType).toBe(s.chartType)
        expect(r.data.data.rowCount).toBeGreaterThan(0)
        expect(Array.isArray(r.data.data.labels)).toBe(true)
        expect(r.data.data.labels.length).toBe(r.data.data.rowCount)
      }
    }
  })

  it('rowCount counts parsed rows only, not arbitrary AST entries', () => {
    // Unquoted-identifier keys are now an E_UNKNOWN_DATA_KEY situation; the
    // inspector should still parse but rowCount reflects only quoted labels.
    const r = inspectDsl({
      source: 'chart bar-vertical { data { a = "foo"  b = "bar" "E" = 1 } }',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.data.rowCount).toBe(1) // only "E" counts
      expect(r.data.data.entryCount).toBe(3) // a, b, "E"
    }
  })

  it('hasHighlights is true for braced highlight syntax', () => {
    const r = inspectDsl({
      source: 'chart bar-vertical { data { "E" = 1 }  highlight "E" { color = "red" } }',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.hasHighlights).toBe(true)
    }
  })

  it('hasHighlights is true for bare highlight syntax', () => {
    const r = inspectDsl({
      source: 'chart bar-vertical { data { "E" = 1 }  highlight "E" }',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.hasHighlights).toBe(true)
    }
  })

  it('forwards parse errors', () => {
    const r = inspectDsl({ source: '@@@ not valid' })
    expect(r.ok).toBe(false)
  })
})
