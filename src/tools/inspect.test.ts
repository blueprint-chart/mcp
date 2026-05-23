import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { inspectDsl } from './inspect'

describe('inspect_dsl', () => {
  it('returns chartType + scene summary for a sample', () => {
    const sample = samples[0]!
    const r = inspectDsl({ source: sample.dsl })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.chartType).toBe(sample.chartType)
      expect(Array.isArray(r.data.scenes)).toBe(true)
      expect(r.data.seriesCount).toBeGreaterThanOrEqual(0)
      expect(r.data.rowCount).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns at least one scene for every shipped sample', () => {
    for (const s of samples) {
      const r = inspectDsl({ source: s.dsl })
      expect(r.ok, `sample ${s.id}`).toBe(true)
      if (r.ok) {
        expect(r.data.scenes.length).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('forwards parse errors', () => {
    const r = inspectDsl({ source: '@@@ not valid' })
    expect(r.ok).toBe(false)
  })
})
