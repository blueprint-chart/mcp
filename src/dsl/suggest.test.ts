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

  it('suggests description for the common subtitle mistake', () => {
    const keys = ['title', 'description', 'byline', 'source', 'sourceUrl', 'note']
    expect(nearestSuggestion('subtitle', keys)).toBe('description')
  })

  it('still does edit-distance matching for other typos', () => {
    const keys = ['title', 'description', 'colorPalette']
    expect(nearestSuggestion('titel', keys)).toBe('title')
  })

  it('falls back to edit-distance when the synonym target is absent from candidates', () => {
    const keys = ['title', 'byline', 'note'] // no 'description'
    // subtitle's synonym (description) isn't a candidate, so the scan runs;
    // nearest by distance among these is 'title'
    expect(nearestSuggestion('subtitle', keys)).toBe('title')
  })
})
