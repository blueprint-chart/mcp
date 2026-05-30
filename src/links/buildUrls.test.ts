import { describe, it, expect } from 'vitest'
import { buildCopyUrl, buildEmbedUrl, buildDocUrl } from './buildUrls'

const EDITOR = 'https://blueprintchart.com'
const DOCS = 'https://docs.blueprintchart.com'
const SRC = 'chart bar-vertical {\n}\n'

describe('buildCopyUrl', () => {
  it('builds a /copy?bpc64= deep-link with url-safe base64', () => {
    expect(buildCopyUrl(SRC, EDITOR)).toBe(
      'https://blueprintchart.com/#/copy?bpc64=Y2hhcnQgYmFyLXZlcnRpY2FsIHsKfQo',
    )
  })

  it('produces a url-safe payload (no +, /, or = to encode)', () => {
    const url = buildCopyUrl(SRC, EDITOR)
    const payload = url.split('bpc64=')[1]!
    expect(payload).not.toMatch(/[+/=]|%/)
  })
})

describe('buildEmbedUrl', () => {
  it('builds a hash /render link with URI-encoded standard base64', () => {
    expect(buildEmbedUrl(SRC, EDITOR)).toBe(
      'https://blueprintchart.com/#/render?bpc64=Y2hhcnQgYmFyLXZlcnRpY2FsIHsKfQo%3D',
    )
  })
})

describe('buildDocUrl', () => {
  it('maps the charts group to the /charts docs path', () => {
    expect(buildDocUrl('charts', 'bar-vertical', DOCS)).toBe(
      'https://docs.blueprintchart.com/charts/bar-vertical',
    )
  })

  it('maps reference/dsl to a nested path', () => {
    expect(buildDocUrl('reference/dsl', 'properties', DOCS)).toBe(
      'https://docs.blueprintchart.com/reference/dsl/properties',
    )
  })
})
