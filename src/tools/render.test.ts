import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { samples } from '@blueprint-chart/lib'
import { renderTool, renderToolContent } from './render'
import { ErrorCode } from '../errors'

describe('render', () => {
  it('returns pure SVG by default', async () => {
    const r = await renderTool({ source: samples[0]!.dsl })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.mimeType).toBe('image/svg+xml')
      expect(r.data.svg).toMatch(/^<svg/)
      expect(r.data.png).toBeUndefined()
      expect(r.data.html).toBeUndefined()
      expect(r.data.frame).toBeDefined()
    }
  })

  it('returns PNG (no svg) when format=png', async () => {
    const r = await renderTool({ source: samples[0]!.dsl, format: 'png', width: 600, height: 400 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.mimeType).toBe('image/png')
      expect(r.data.svg).toBeUndefined() // CHANGED: svg no longer included with png
      expect(r.data.png).toBeTypeOf('string') // base64
      expect(r.data.png!.length).toBeGreaterThan(100)
      expect(r.data.frame).toBeDefined()
    }
  })

  it('forwards parse errors', async () => {
    const r = await renderTool({ source: '@@@' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_PARSE')
    }
  })

  it('returns E_INPUT for invalid zod input', async () => {
    const r = await renderTool({ source: samples[0]!.dsl, width: -10 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_INPUT')
      expect(r.errors.length).toBeGreaterThan(0)
    }
  })
})

describe('render — frame defaults', () => {
  it('format=svg returns pure SVG without HTML wrapper', async () => {
    const { samples } = await import('@blueprint-chart/lib')
    const sample = samples.find(s => s.id === 'letter-frequency')!
    const r = await renderTool({ source: sample.dsl, format: 'svg' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.svg).toMatch(/^<svg/)
      expect(r.data.svg).not.toContain('<div class="bc-frame"')
      expect(r.data.html).toBeUndefined()
    }
  })

  it('format=svg on letter-frequency returns correct frame.title', async () => {
    const { samples } = await import('@blueprint-chart/lib')
    const sample = samples.find(s => s.id === 'letter-frequency')!
    const r = await renderTool({ source: sample.dsl, format: 'svg' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.frame.title).toBe('E is the most frequent letter in English')
    }
  })

  it('format=html returns html containing bc-frame and svg', async () => {
    const { samples } = await import('@blueprint-chart/lib')
    const sample = samples.find(s => s.id === 'letter-frequency')!
    const r = await renderTool({ source: sample.dsl, format: 'html' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.mimeType).toBe('text/html')
      expect(r.data.html).toContain('<div class="bc-frame"')
      expect(r.data.html).toContain('<svg')
      expect(r.data.svg).toBeUndefined() // CHANGED: svg no longer included with html
      expect(r.data.frame).toBeDefined()
    }
  })
})

describe('render — save option (MCP_FS_WRITE_DIR sandbox)', () => {
  const BAR = 'chart bar-vertical { title = "x"  data { "E" = 1 } }'
  const ORIGINAL = process.env.MCP_FS_WRITE_DIR

  function makeJail(): string {
    return mkdtempSync(join(tmpdir(), 'mcp-jail-'))
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true })
  }

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.MCP_FS_WRITE_DIR
    }
    else {
      process.env.MCP_FS_WRITE_DIR = ORIGINAL
    }
  })

  it('errors with E_FS_WRITE_DISABLED when MCP_FS_WRITE_DIR is unset', async () => {
    delete process.env.MCP_FS_WRITE_DIR
    const r = await renderTool({ source: BAR, format: 'svg', save: 'out.svg' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_FS_WRITE_DISABLED')
    }
  })

  it('errors with E_FS_WRITE_DISABLED when MCP_FS_WRITE_DIR is whitespace', async () => {
    process.env.MCP_FS_WRITE_DIR = '   '
    const r = await renderTool({ source: BAR, format: 'svg', save: 'out.svg' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_FS_WRITE_DISABLED')
    }
  })

  it('writes a relative save under the sandbox root', async () => {
    const jail = makeJail()
    process.env.MCP_FS_WRITE_DIR = jail
    try {
      const r = await renderTool({ source: BAR, format: 'svg', save: 'out.svg' })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.savedTo).toBe(join(jail, 'out.svg'))
        expect(r.data.svg).toBeUndefined()
        expect(existsSync(join(jail, 'out.svg'))).toBe(true)
      }
    }
    finally {
      cleanup(jail)
    }
  })

  it('writes an absolute save that is inside the sandbox', async () => {
    const jail = makeJail()
    process.env.MCP_FS_WRITE_DIR = jail
    try {
      const target = join(jail, 'a.svg')
      const r = await renderTool({ source: BAR, format: 'svg', save: target })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.savedTo).toBe(target)
      }
    }
    finally {
      cleanup(jail)
    }
  })

  it('auto-creates nested subdirectories under the sandbox', async () => {
    const jail = makeJail()
    process.env.MCP_FS_WRITE_DIR = jail
    try {
      const r = await renderTool({ source: BAR, format: 'svg', save: 'deep/nested/dir/a.svg' })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.savedTo).toBe(join(jail, 'deep/nested/dir/a.svg'))
        expect(existsSync(join(jail, 'deep/nested/dir/a.svg'))).toBe(true)
      }
    }
    finally {
      cleanup(jail)
    }
  })

  it('remaps an absolute save outside the sandbox to a jail-relative path', async () => {
    const jail = makeJail()
    process.env.MCP_FS_WRITE_DIR = jail
    try {
      // an absolute path pointing outside the jail: the leading slash is stripped and
      // the rest joined under the sandbox, so it lands inside rather than being rejected
      const r = await renderTool({ source: BAR, format: 'svg', save: '/var/lib/escape.svg' })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.savedTo).toBe(join(jail, 'var/lib/escape.svg'))
        expect(existsSync(join(jail, 'var/lib/escape.svg'))).toBe(true)
      }
      // the real out-of-jail location was never touched
      expect(existsSync('/var/lib/escape.svg')).toBe(false)
    }
    finally {
      cleanup(jail)
    }
  })

  it('rejects ../ traversal escaping the sandbox with E_FS_WRITE_ESCAPE', async () => {
    const jail = makeJail()
    process.env.MCP_FS_WRITE_DIR = jail
    try {
      const r = await renderTool({ source: BAR, format: 'svg', save: '../escape.svg' })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors[0]!.code).toBe('E_FS_WRITE_ESCAPE')
      }
      expect(existsSync(join(dirname(jail), 'escape.svg'))).toBe(false)
    }
    finally {
      cleanup(jail)
    }
  })

  it('rejects an absolute path whose embedded ../ traversal still escapes', async () => {
    const jail = makeJail()
    process.env.MCP_FS_WRITE_DIR = jail
    try {
      const r = await renderTool({ source: BAR, format: 'svg', save: '/a/../../../../etc/passwd' })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.errors[0]!.code).toBe('E_FS_WRITE_ESCAPE')
      }
    }
    finally {
      cleanup(jail)
    }
  })
})

describe('render — structured diagnostics', () => {
  it('returns E_SEMANTIC + E_UNKNOWN_CHART_TYPE for chart bar', async () => {
    const r = await renderTool({ source: 'chart bar { data { "E" = 1 } }' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_SEMANTIC')
      expect(r.errors[0]!.code).toBe('E_UNKNOWN_CHART_TYPE')
      expect(r.errors[0]!.suggestion).toMatch(/^bar-/)
    }
  })

  it('returns E_SEMANTIC + E_EMPTY_DATA when data is empty', async () => {
    const r = await renderTool({ source: 'chart bar-vertical { title = "x" }' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_SEMANTIC')
      expect(r.errors[0]!.code).toBe('E_EMPTY_DATA')
    }
  })

  it('never returns the generic "produced no SVG output" message', async () => {
    const r = await renderTool({ source: 'chart bar { data { "E" = 1 } }' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      for (const e of r.errors) {
        expect(e.message).not.toContain('produced no SVG output')
      }
    }
  })

  it('renders every sample to SVG and provides frame metadata', async () => {
    const { samples } = await import('@blueprint-chart/lib')
    for (const s of samples) {
      const r = await renderTool({ source: s.dsl, format: 'svg' })
      expect(r.ok, `sample ${s.id}`).toBe(true)
      if (r.ok) {
        expect(r.data.frame, `sample ${s.id} frame`).toBeDefined()
      }
    }
  })
})

describe('render png content blocks', () => {
  const VALID = 'chart bar-vertical {\n  title = "Hi"\n  data {\n    "A" = 1\n  }\n}\n'
  afterEach(() => {
    delete process.env.MCP_PUBLIC_URL
  })

  it('png responses drop the svg field and carry base64 png', async () => {
    const result = await renderTool({ source: VALID, format: 'png' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.png).toMatch(/^[A-Za-z0-9+/=]+$/)
      expect(result.data.svg).toBeUndefined() // REGRESSION: was included
      expect(result.data.modelVisible).toBe(true)
    }
  })

  it('renderToolContent emits [image, text] and strips base64 from the text block', async () => {
    const result = await renderTool({ source: VALID, format: 'png' })
    const formatted = renderToolContent(result)
    expect(formatted.content).toHaveLength(2)
    expect(formatted.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
    const text = (formatted.content[1] as { text: string }).text
    expect(text).toContain('"frame"')
    expect(text).not.toContain((result as { data: { png: string } }).data.png.slice(0, 40))
  })

  it('modelVisible:false drops the image block so it costs no tokens', async () => {
    const result = await renderTool({ source: VALID, format: 'png', modelVisible: false })
    const formatted = renderToolContent(result)
    expect(formatted.content).toHaveLength(1)
    expect(formatted.content[0]).toMatchObject({ type: 'text' })
  })

  it('svg/html/error results format as a single text block carrying the markup', async () => {
    const svgResult = await renderTool({ source: VALID, format: 'svg' })
    expect(renderToolContent(svgResult).content).toHaveLength(1)
    expect(renderToolContent(svgResult).structuredContent).toMatchObject({ svg: expect.stringMatching(/^<svg/) })
    const errResult = await renderTool({ source: 'chart nope {' })
    expect(renderToolContent(errResult).isError).toBe(true)
  })

  it('includes urls on every format when MCP_PUBLIC_URL is set, omits otherwise', async () => {
    process.env.MCP_PUBLIC_URL = 'https://mcp.example.com'
    const withUrls = await renderTool({ source: VALID, format: 'svg' })
    expect(withUrls.ok).toBe(true)
    if (withUrls.ok) {
      expect(withUrls.data.urls?.png).toContain('https://mcp.example.com/render.png?')
      expect(withUrls.data.urls?.bpc).toContain('/render.bpc?')
    }
    delete process.env.MCP_PUBLIC_URL
    const without = await renderTool({ source: VALID, format: 'svg' })
    expect(without.ok).toBe(true)
    if (without.ok) {
      expect(without.data.urls).toBeUndefined()
    }
  })

  it('sets urlsOmitted for oversized sources instead of failing', async () => {
    process.env.MCP_PUBLIC_URL = 'https://mcp.example.com'
    const big = `chart bar-vertical {\n  data {\n${Array.from({ length: 800 }, (_, i) => `    "0r${i}" = 1\n`).join('')}  }\n}\n`
    const result = await renderTool({ source: big, format: 'svg' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.urls).toBeUndefined()
      expect(result.data.urlsOmitted).toBe('source-too-large')
    }
  })

  it('rejects width above 1600 at the schema layer', async () => {
    const result = await renderTool({ source: VALID, width: 5000 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_INPUT)
    }
  })
})
