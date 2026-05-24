import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { renderSceneState } from './renderSceneState'

describe('renderSceneState', () => {
  it('returns pure SVG (no HTML wrapper) for the first sample, scene 0', () => {
    const result = renderSceneState(samples[0]!.dsl, { sceneIndex: 0, width: 800, height: 500 })
    expect(result.svg).toMatch(/^<svg/)
    expect(result.svg).toContain('</svg>')
    expect(result.svg.length).toBeGreaterThan(500)
  })

  it('returns frame html containing bc-frame and the svg', () => {
    const result = renderSceneState(samples[0]!.dsl, { sceneIndex: 0, width: 800, height: 500 })
    expect(result.html).toBeDefined()
    expect(result.html).toContain('<div class="bc-frame"')
    expect(result.html).toContain('<svg')
  })

  it('clamps sceneIndex when out of bounds', () => {
    const result = renderSceneState(samples[0]!.dsl, { sceneIndex: 999, width: 400, height: 300 })
    expect(result.svg).toMatch(/^<svg/)
  })

  it('throws for unparseable input (callers catch)', () => {
    expect(() => renderSceneState('@@@ nope', { width: 400, height: 300 })).toThrow()
  })
})
