import { afterEach, describe, expect, it } from 'vitest'
import { listAllResources, publicDocUrl, readResource } from './docsReader'

afterEach(() => {
  delete process.env.BLUEPRINT_CHART_DOCS_URL
})

describe('publicDocUrl', () => {
  it('returns undefined when docs base is unset', () => {
    expect(publicDocUrl('charts', 'bar-vertical')).toBeUndefined()
  })

  it('builds a public docs URL when configured', () => {
    process.env.BLUEPRINT_CHART_DOCS_URL = 'https://docs.blueprintchart.com'
    expect(publicDocUrl('charts', 'bar-vertical')).toBe('https://docs.blueprintchart.com/charts/bar-vertical')
  })
})

describe('listAllResources docsUrl', () => {
  it('omits docsUrl when docs base is unset', () => {
    const grammar = listAllResources().find(r => r.uri === 'bpc://grammar')
    const charts = listAllResources().find(r => r.uri.startsWith('bpc://chart-types/'))
    expect(grammar?.docsUrl).toBeUndefined()
    expect(charts?.docsUrl).toBeUndefined()
  })

  it('includes docsUrl on doc resources when configured', () => {
    process.env.BLUEPRINT_CHART_DOCS_URL = 'https://docs.blueprintchart.com'
    const charts = listAllResources().find(r => r.uri.startsWith('bpc://chart-types/'))
    expect(charts?.docsUrl).toMatch(/^https:\/\/docs\.blueprintchart\.com\/charts\//)
  })
})

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
