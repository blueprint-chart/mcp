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
})
