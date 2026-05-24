import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { diagnoseRender } from './diagnose'

describe('diagnoseRender', () => {
  it('returns ok for every shipped sample', () => {
    for (const s of samples) {
      const r = diagnoseRender(s.dsl)
      expect(r.ok, `sample ${s.id}: ${JSON.stringify(r)}`).toBe(true)
    }
  })

  it('reports E_UNKNOWN_CHART_TYPE for chart bar', () => {
    const r = diagnoseRender('chart bar { data { "E" = 1 } }')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const issue = r.diagnostics.find(d => d.code === 'E_UNKNOWN_CHART_TYPE')
      expect(issue).toBeDefined()
      expect(issue!.suggestion).toMatch(/^bar-/)
    }
  })

  it('reports E_NO_DATA when data is empty', () => {
    const r = diagnoseRender('chart bar-vertical {}')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.diagnostics.some(d => d.code === 'E_NO_DATA')).toBe(true)
    }
  })

  it('reports E_UNKNOWN_SCENE_INDEX when sceneIndex is out of range', () => {
    const r = diagnoseRender('chart bar-vertical { data { "E" = 1 } }', { sceneIndex: 5 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const issue = r.diagnostics.find(d => d.code === 'E_UNKNOWN_SCENE_INDEX')
      expect(issue).toBeDefined()
      expect(issue!.context?.availableSceneCount).toBe(0)
    }
  })

  it('reports E_UNRESOLVED_COLORIZE when colorize target is not a label', () => {
    const r = diagnoseRender(
      'chart bar-vertical { data { "E" = 1 } colorize "Z" { color = "red" } }',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const issue = r.diagnostics.find(d => d.code === 'E_UNRESOLVED_COLORIZE')
      expect(issue).toBeDefined()
      expect(issue!.context?.target).toBe('Z')
      expect(issue!.context?.availableLabels).toEqual(['E'])
    }
  })
})
