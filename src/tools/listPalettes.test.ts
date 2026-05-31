import { describe, expect, it } from 'vitest'
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
})
