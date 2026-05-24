import { describe, expect, it } from 'vitest'
import {
  CHART_TYPE_ALIASES,
  aliasesFor,
  canonicalChartType,
  isKnownChartType,
  listCanonicalChartTypes,
} from './chartTypes'

describe('chartTypes', () => {
  it('lists canonical chart types', () => {
    const canon = listCanonicalChartTypes()
    expect(canon).toContain('bar-vertical')
    expect(canon).toContain('bar-horizontal')
    expect(canon).not.toContain('horizontal-bar') // alias excluded
  })

  it('maps aliases to canonical names', () => {
    expect(CHART_TYPE_ALIASES['horizontal-bar']).toBe('bar-horizontal')
    expect(CHART_TYPE_ALIASES['vertical-bar']).toBe('bar-vertical')
  })

  it('canonicalChartType returns canonical for alias or canonical', () => {
    expect(canonicalChartType('horizontal-bar')).toBe('bar-horizontal')
    expect(canonicalChartType('bar-horizontal')).toBe('bar-horizontal')
  })

  it('canonicalChartType returns undefined for unknown', () => {
    expect(canonicalChartType('bar')).toBeUndefined()
    expect(canonicalChartType('totally-fake')).toBeUndefined()
  })

  it('isKnownChartType accepts canonical and aliases', () => {
    expect(isKnownChartType('bar-vertical')).toBe(true)
    expect(isKnownChartType('horizontal-bar')).toBe(true)
    expect(isKnownChartType('bar')).toBe(false)
  })

  it('aliasesFor returns the registered aliases for a canonical name', () => {
    expect(aliasesFor('bar-horizontal')).toEqual(['horizontal-bar'])
    expect(aliasesFor('bar-vertical')).toEqual(['vertical-bar'])
    expect(aliasesFor('bar-stacked')).toEqual([])
  })
})
