import { describe, expect, it } from 'vitest'
import { nearestSuggestion } from './suggest'

describe('nearestSuggestion', () => {
  it('returns the closest match within edit distance', () => {
    expect(nearestSuggestion('bar', ['bar-vertical', 'bar-horizontal', 'line']))
      .toBe('bar-vertical')
  })

  it('returns the alphabetically-first on tie', () => {
    expect(nearestSuggestion('xx', ['ab', 'ba'])).toBe('ab')
  })

  it('returns undefined when no candidate is within max distance', () => {
    expect(nearestSuggestion('zz', ['absolutely-unrelated'], 3)).toBeUndefined()
  })

  it('returns undefined when candidates is empty', () => {
    expect(nearestSuggestion('any', [])).toBeUndefined()
  })

  it('handles exact match', () => {
    expect(nearestSuggestion('line', ['line', 'pie'])).toBe('line')
  })
})
