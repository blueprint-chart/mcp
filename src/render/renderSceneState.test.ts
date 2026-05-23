import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { renderSceneState } from './renderSceneState'

describe('renderSceneState', () => {
  it('returns non-empty SVG for the first sample, scene 0', () => {
    const svg = renderSceneState(samples[0]!.dsl, { sceneIndex: 0, width: 800, height: 500 })
    expect(svg).toMatch(/^<svg/)
    expect(svg).toMatch(/<\/svg>$/)
    expect(svg.length).toBeGreaterThan(500)
  })

  it('clamps sceneIndex when out of bounds', () => {
    const svg = renderSceneState(samples[0]!.dsl, { sceneIndex: 999, width: 400, height: 300 })
    expect(svg).toMatch(/^<svg/)
  })

  it('throws for unparseable input (callers catch)', () => {
    expect(() => renderSceneState('@@@ nope', { width: 400, height: 300 })).toThrow()
  })
})
