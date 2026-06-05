import { describe, it, expect } from 'vitest'
import { buildCopyUrl, buildEmbedUrl, buildDocUrl, buildRenderUrls, MAX_RENDER_URL_LENGTH } from './buildUrls'

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

describe('buildRenderUrls', () => {
  const BASE = 'https://mcp.blueprintchart.com'
  const SRC = 'chart bar-vertical {\n  data {\n    "A" = 1\n  }\n}\n'

  it('builds png/svg/bpc URLs with dimensions and optional scene', () => {
    const urls = buildRenderUrls(SRC, { width: 800, height: 500, scene: 2 }, BASE)
    expect(urls?.png).toMatch(/^https:.*\/render\.png\?bpc64=[A-Za-z0-9_-]+&width=800&height=500&scene=2$/)
    expect(urls?.svg).toContain('/render.svg?')
    expect(urls?.bpc).toMatch(/\/render\.bpc\?bpc64=[A-Za-z0-9_-]+$/)
  })

  it('omits scene when not provided', () => {
    const urls = buildRenderUrls(SRC, { width: 800, height: 500 }, BASE)
    expect(urls?.png).not.toContain('scene=')
  })

  it('returns undefined when any URL would exceed MAX_RENDER_URL_LENGTH', () => {
    const huge = `chart bar-vertical {\n  data {\n${'    "row" = 1\n'.repeat(800)}  }\n}\n`
    expect(Buffer.from(huge).toString('base64').length).toBeGreaterThan(MAX_RENDER_URL_LENGTH)
    expect(buildRenderUrls(huge, { width: 800, height: 500 }, BASE)).toBeUndefined()
  })
})
