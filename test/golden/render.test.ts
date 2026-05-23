import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { renderSceneState } from '../../src/render/renderSceneState'

const PICK = [
  'letter-frequency',
  'co2-emissions',
  'quarterly-revenue',
  'browser-market',
  'temperature-anomaly',
  'population-stacked-bar',
]

describe('golden render', () => {
  for (const id of PICK) {
    const sample = samples.find(s => s.id === id)
    if (!sample) continue
    it(`renders stable SVG for sample "${id}"`, () => {
      const svg = renderSceneState(sample.dsl, { sceneIndex: 0, width: 800, height: 500 })
      // Normalize transient bits: D3-generated IDs and `url(#…)` refs.
      const normalized = svg
        .replace(/id="[a-zA-Z0-9_-]+"/g, 'id="X"')
        .replace(/url\(#[a-zA-Z0-9_-]+\)/g, 'url(#X)')
      expect(normalized).toMatchSnapshot()
    })
  }
})
