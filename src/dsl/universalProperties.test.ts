import { describe, expect, it } from 'vitest'
import { UNIVERSAL_PROPERTIES, isUniversalProperty } from './universalProperties'

describe('universalProperties', () => {
  it('includes attribution metadata', () => {
    expect(UNIVERSAL_PROPERTIES.has('title')).toBe(true)
    expect(UNIVERSAL_PROPERTIES.has('description')).toBe(true)
    expect(UNIVERSAL_PROPERTIES.has('byline')).toBe(true)
    expect(UNIVERSAL_PROPERTIES.has('source')).toBe(true)
    expect(UNIVERSAL_PROPERTIES.has('sourceUrl')).toBe(true)
    expect(UNIVERSAL_PROPERTIES.has('note')).toBe(true)
  })

  it('includes universal sort directives', () => {
    expect(UNIVERSAL_PROPERTIES.has('sort')).toBe(true)
    expect(UNIVERSAL_PROPERTIES.has('sortMode')).toBe(true)
  })

  it('isUniversalProperty matches', () => {
    expect(isUniversalProperty('title')).toBe(true)
    expect(isUniversalProperty('madeUpKey')).toBe(false)
  })
})
