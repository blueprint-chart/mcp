import { describe, expect, it } from 'vitest'
import type { PropertyNode } from '@blueprint-chart/lib'
import { looksLikeUnquotedKey, looksLikeQuotedLabel } from './dataKey'

function node(key: string): PropertyNode {
  return { key, value: 1 } as unknown as PropertyNode
}

describe('dataKey helpers', () => {
  it('looksLikeUnquotedKey flags camelCase identifiers', () => {
    expect(looksLikeUnquotedKey(node('unquotedKey'))).toBe(true)
    expect(looksLikeUnquotedKey(node('sort'))).toBe(true)
  })

  it('looksLikeUnquotedKey passes proper-noun labels through', () => {
    expect(looksLikeUnquotedKey(node('China'))).toBe(false)
    expect(looksLikeUnquotedKey(node('United States'))).toBe(false)
  })

  it('looksLikeQuotedLabel excludes the unquoted series meta-row', () => {
    expect(looksLikeQuotedLabel(node('series'))).toBe(false)
  })

  it('looksLikeQuotedLabel treats a quoted "series" row as a real label', () => {
    const quoted = { key: 'series', value: 1, quotedKey: true } as unknown as PropertyNode
    expect(looksLikeQuotedLabel(quoted)).toBe(true)
  })

  it('looksLikeQuotedLabel accepts proper-noun labels', () => {
    expect(looksLikeQuotedLabel(node('China'))).toBe(true)
    expect(looksLikeQuotedLabel(node('New York'))).toBe(true)
  })

  it('looksLikeQuotedLabel rejects camelCase keys', () => {
    expect(looksLikeQuotedLabel(node('sort'))).toBe(false)
    expect(looksLikeQuotedLabel(node('colorPalette'))).toBe(false)
  })

  it('respects tagged isQuoted field when present', () => {
    const tagged = { key: 'someKey', value: 1, isQuoted: true } as unknown as PropertyNode
    expect(looksLikeUnquotedKey(tagged)).toBe(false)
    expect(looksLikeQuotedLabel(tagged)).toBe(true)

    const untagged = { key: 'SomeKey', value: 1, isQuoted: false } as unknown as PropertyNode
    expect(looksLikeUnquotedKey(untagged)).toBe(true)
    expect(looksLikeQuotedLabel(untagged)).toBe(false)
  })
})
