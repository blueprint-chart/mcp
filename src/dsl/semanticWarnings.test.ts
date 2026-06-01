import { describe, expect, it } from 'vitest'
import { parseDsl } from '../parse'
import { collectWarnings } from './semanticWarnings'

function warn(src: string) {
  const r = parseDsl(src)
  if (!r.ok) {
    throw new Error('parse failed: ' + JSON.stringify(r.errors))
  }
  return collectWarnings(r.data.ast)
}

describe('collectWarnings', () => {
  it('warns W_NO_EFFECT for sort on donut', () => {
    const w = warn('chart donut {\n  sort = descending\n  data {\n    "A" = 1\n    "B" = 2\n  }\n}')
    expect(w.some(i => i.code === 'W_NO_EFFECT' && i.path === 'chart.sort')).toBe(true)
  })

  it('does not warn for colorize on donut (now supported since W1c)', () => {
    const w = warn('chart donut {\n  data { "A" = 1 }\n  colorize "A" { color = "#f00" }\n}')
    expect(w.some(i => i.path.includes('colorize'))).toBe(false)
  })

  it('warns W_MULTISERIES_SHAPE when a multi-series type parsed zero series', () => {
    const w = warn('chart bar-multi {\n  data {\n    "A" = 1\n    "B" = 2\n  }\n}')
    expect(w.some(i => i.code === 'W_MULTISERIES_SHAPE')).toBe(true)
  })

  it('is silent for a well-formed multi-series chart', () => {
    const w = warn('chart bar-multi {\n  data {\n    _series = "X","Y"\n    "A" = 1,2\n    "B" = 3,4\n  }\n}')
    expect(w.filter(i => i.code === 'W_MULTISERIES_SHAPE')).toEqual([])
  })

  it('is silent for a clean single-series bar chart', () => {
    const w = warn('chart bar-vertical {\n  title = "t"\n  data { "A" = 1 }\n}')
    expect(w).toEqual([])
  })
})
