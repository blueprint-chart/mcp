import { describe, expect, it } from 'vitest'
import { listPalettes } from '@blueprint-chart/lib'
import { listPalettesTool } from './listPalettes'

describe('list_palettes', () => {
  it('returns named palettes with their colours', () => {
    const r = listPalettesTool()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.palettes.length).toBeGreaterThan(0)
      const first = r.data.palettes[0]!
      expect(first).toHaveProperty('name')
      expect(Array.isArray(first.colors)).toBe(true)
      expect(first.colors.length).toBeGreaterThan(0)
    }
  })

  it('exposes every palette the library registers, including the brand palette', () => {
    const r = listPalettesTool()
    expect(r.ok).toBe(true)
    if (r.ok) {
      const names = r.data.palettes.map(p => p.name)
      expect(names).toHaveLength(listPalettes().length)
      expect(names).toContain('BlueprintBold')
    }
  })
})
