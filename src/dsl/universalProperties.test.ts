import { describe, expect, it } from 'vitest'
import { UNIVERSAL_PROPERTIES, UNIVERSAL_PROPERTY_META, isUniversalProperty } from './universalProperties'

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

  it('UNIVERSAL_PROPERTY_META has schema entries matching the set', () => {
    expect(UNIVERSAL_PROPERTY_META['title']?.type).toBe('text')
    expect(UNIVERSAL_PROPERTY_META['sort']?.choices).toContain('ascending')
    // Membership and metadata are in lockstep
    expect(new Set(Object.keys(UNIVERSAL_PROPERTY_META))).toEqual(UNIVERSAL_PROPERTIES)
  })
})
