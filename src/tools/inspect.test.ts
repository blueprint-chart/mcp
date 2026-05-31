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

describe('inspect_dsl fixes', () => {
  it('lists ALL series names from the _series header', () => {
    const src = 'chart bar-multi {\n  data {\n    _series = "Hardware","Software","Services"\n    "Q1" = 1,2,3\n  }\n}'
    const r = inspectDsl({ source: src })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.data.seriesNames).toEqual(['Hardware', 'Software', 'Services'])
      expect(r.data.data.multiSeries).toBe(true)
    }
  })

  it('reports hasHighlights:true when a highlight lives inside a scene', () => {
    const src = 'chart area-stacked {\n  data {\n    _series = "A","B"\n    "2000" = 1,2\n  }\n  scene "S1" {\n    highlight "A"\n  }\n}'
    const r = inspectDsl({ source: src })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.hasHighlights).toBe(true)
    }
  })

  it('reports hasColorizes:true when a colorize lives inside a scene', () => {
    const src = 'chart area-stacked {\n  data {\n    _series = "A","B"\n    "2000" = 1,2\n  }\n  scene "S1" {\n    colorize "A" { color = "#f00" }\n  }\n}'
    const r = inspectDsl({ source: src })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.hasColorizes).toBe(true)
    }
  })
})
