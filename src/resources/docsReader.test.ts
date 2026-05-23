import { describe, expect, it } from 'vitest'
import { listAllResources, readResource } from './docsReader'

describe('docsReader', () => {
  it('lists handbook entries', () => {
    const list = listAllResources()
    expect(list.some(r => r.uri.startsWith('bpc://handbook/'))).toBe(true)
  })

  it('reads a known handbook page', () => {
    const list = listAllResources()
    const first = list.find(r => r.uri.startsWith('bpc://handbook/'))!
    const doc = readResource(first.uri)
    expect(doc.mimeType).toBe('text/markdown')
    expect(doc.text.length).toBeGreaterThan(100)
  })

  it('throws on unknown URI', () => {
    expect(() => readResource('bpc://handbook/does-not-exist')).toThrow()
  })

  it('exposes bpc://grammar as an aggregate of reference/dsl pages', () => {
    const list = listAllResources()
    expect(list.some(r => r.uri === 'bpc://grammar')).toBe(true)

    const doc = readResource('bpc://grammar')
    expect(doc.text.length).toBeGreaterThan(500)
  })
})
