import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { samples } from '@blueprint-chart/lib'
import { renderTool } from './render'

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

  it('returns both SVG and PNG when format=png', async () => {
    const r = await renderTool({ source: samples[0]!.dsl, format: 'png', width: 600, height: 400 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.mimeType).toBe('image/png')
      expect(r.data.svg).toMatch(/^<svg/)
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
      expect(r.data.svg).toMatch(/^<svg/)
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
