import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { renderTool } from './render'

describe('render', () => {
  it('returns SVG by default', async () => {
    const r = await renderTool({ source: samples[0]!.dsl })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.mimeType).toBe('image/svg+xml')
      expect(r.data.svg).toMatch(/^<svg/)
      expect(r.data.png).toBeUndefined()
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

  it('renders every sample to SVG', async () => {
    const { samples } = await import('@blueprint-chart/lib')
    for (const s of samples) {
      const r = await renderTool({ source: s.dsl, format: 'svg' })
      expect(r.ok, `sample ${s.id}`).toBe(true)
    }
  })
})
