import { describe, expect, it } from 'vitest'
import { parse } from '@blueprint-chart/lib'
import { validateAst } from './validate'

function ast(src: string) {
  return parse(src)
}

describe('validateAst', () => {
  it('returns empty issues for a known chart type with data', () => {
    const a = ast('chart bar-vertical { data { "E" = 1 } }')
    expect(validateAst(a)).toEqual([])
  })

  it('reports E_UNKNOWN_CHART_TYPE with suggestion', () => {
    const a = ast('chart bar { data { "E" = 1 } }')
    const issues = validateAst(a)
    expect(issues.length).toBeGreaterThanOrEqual(1)
    const chartIssue = issues.find(i => i.code === 'E_UNKNOWN_CHART_TYPE')
    expect(chartIssue).toBeDefined()
    expect(chartIssue!.path).toBe('chart')
    expect(chartIssue!.suggestion).toMatch(/^bar-/)
    expect(chartIssue!.context?.got).toBe('bar')
    expect(Array.isArray(chartIssue!.context?.known)).toBe(true)
  })

  it('reports E_EMPTY_DATA when data block is missing', () => {
    const a = ast('chart bar-vertical { title = "x" }')
    const issues = validateAst(a)
    expect(issues.some(i => i.code === 'E_EMPTY_DATA')).toBe(true)
  })

  it('reports E_EMPTY_DATA when data block has zero entries', () => {
    const a = ast('chart bar-vertical { data {} }')
    const issues = validateAst(a)
    expect(issues.some(i => i.code === 'E_EMPTY_DATA')).toBe(true)
  })

  it('does not double-report when chart type is unknown but data is fine', () => {
    const a = ast('chart bar { data { "E" = 1 } }')
    const issues = validateAst(a)
    expect(issues.find(i => i.code === 'E_EMPTY_DATA')).toBeUndefined()
  })
})
