import { describe, expect, it } from 'vitest'
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

describe('render — save option', () => {
  it('errors when MCP_ALLOW_FS_WRITE is unset', async () => {
    delete process.env.MCP_ALLOW_FS_WRITE
    const r = await renderTool({
      source: 'chart bar-vertical { data { "E" = 1 } }',
      format: 'png',
      save: '/tmp/test.png',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_FS_WRITE_DISABLED')
    }
  })

  it('writes the PNG when MCP_ALLOW_FS_WRITE=1', async () => {
    process.env.MCP_ALLOW_FS_WRITE = '1'
    const { samples } = await import('@blueprint-chart/lib')
    const sample = samples.find(s => s.id === 'letter-frequency')!
    const tmp = `/tmp/mcp-render-test-${Date.now()}.png`
    try {
      const r = await renderTool({ source: sample.dsl, format: 'png', save: tmp })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.savedTo).toBe(tmp)
        expect(r.data.png).toBeUndefined() // inline payload omitted
        const { statSync } = await import('node:fs')
        expect(statSync(tmp).size).toBeGreaterThan(1000) // real PNG, not stub
      }
    }
    finally {
      const { unlinkSync, existsSync } = await import('node:fs')
      if (existsSync(tmp)) {
        unlinkSync(tmp)
      }
      delete process.env.MCP_ALLOW_FS_WRITE
    }
  })

  it('writes the SVG when format=svg and save provided', async () => {
    process.env.MCP_ALLOW_FS_WRITE = '1'
    const tmp = `/tmp/mcp-render-test-${Date.now()}.svg`
    try {
      const r = await renderTool({
        source: 'chart bar-vertical { title = "x"  data { "E" = 1 } }',
        format: 'svg',
        save: tmp,
      })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.savedTo).toBe(tmp)
        expect(r.data.svg).toBeUndefined()
      }
    }
    finally {
      const { unlinkSync, existsSync } = await import('node:fs')
      if (existsSync(tmp)) {
        unlinkSync(tmp)
      }
      delete process.env.MCP_ALLOW_FS_WRITE
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
