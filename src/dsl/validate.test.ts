import { describe, expect, it } from 'vitest'
import { parse, samples } from '@blueprint-chart/lib'
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

describe('validateAst — properties and data keys', () => {
  it('reports E_UNKNOWN_PROPERTY for an unknown chart-level key', () => {
    const a = ast('chart bar-vertical { totallyMadeUp = 1  data { "E" = 1 } }')
    const issues = validateAst(a)
    const unk = issues.find(i => i.code === 'E_UNKNOWN_PROPERTY')
    expect(unk).toBeDefined()
    expect(unk!.context?.got).toBe('totallyMadeUp')
  })

  it('does not report a known per-chart-type property as unknown', () => {
    const a = ast('chart bar-vertical { barGap = 0.2  data { "E" = 1 } }')
    expect(validateAst(a).filter(i => i.code === 'E_UNKNOWN_PROPERTY')).toEqual([])
  })

  it('does not report a known universal property as unknown', () => {
    const a = ast('chart bar-vertical { title = "x"  data { "E" = 1 } }')
    expect(validateAst(a).filter(i => i.code === 'E_UNKNOWN_PROPERTY')).toEqual([])
  })

  it('suggests a near-miss universal property', () => {
    const a = ast('chart bar-vertical { titl = "x"  data { "E" = 1 } }')
    const issues = validateAst(a)
    const unk = issues.find(i => i.code === 'E_UNKNOWN_PROPERTY')
    expect(unk?.suggestion).toBe('title')
  })

  it('reports E_UNKNOWN_DATA_KEY for unquoted-identifier data keys when chart expects labels', () => {
    const a = ast('chart bar-vertical { data { unquotedKey = 1 } }')
    const issues = validateAst(a)
    expect(issues.some(i => i.code === 'E_UNKNOWN_DATA_KEY')).toBe(true)
  })

  it('roundtrips every shipped sample with no errors', () => {
    for (const sample of samples) {
      const a = ast(sample.dsl)
      const issues = validateAst(a)
      expect(issues, `sample ${sample.id}: ${JSON.stringify(issues)}`).toEqual([])
    }
  })
})
