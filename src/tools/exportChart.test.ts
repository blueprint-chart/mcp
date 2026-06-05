import { describe, it, expect, afterEach, vi } from 'vitest'
import { exportChart, exportChartContent } from './exportChart'
import { ErrorCode } from '../errors'

const VALID = 'chart bar-vertical {\n  title = "Hi"\n  data {\n    "A" = 1\n  }\n}\n'

afterEach(() => {
  delete process.env.BLUEPRINT_CHART_EDITOR_URL
  delete process.env.MCP_PUBLIC_URL
})

describe('exportChart', () => {
  it('returns E_CONFIG when the editor base URL is unset', async () => {
    const result = await exportChart({ source: VALID })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_CONFIG)
      expect(result.errors[0]?.message).toMatch(/BLUEPRINT_CHART_EDITOR_URL/)
    }
  })

  it('returns E_INPUT when source is missing', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = await exportChart({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_INPUT)
    }
  })

  it('propagates E_PARSE from the shared validation pipeline', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = await exportChart({ source: 'chart bar-vertical {' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_PARSE)
    }
  })

  it('returns copy + embed URLs and frame for a valid source', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = await exportChart({ source: VALID })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.copyUrl).toMatch(/^https:\/\/blueprintchart\.com\/#\/copy\?bpc64=/)
      expect(result.data.embedUrl).toMatch(/^https:\/\/blueprintchart\.com\/#\/render\?bpc64=/)
      expect(result.data.frame.title).toBe('Hi')
    }
  })
})

describe('export preview', () => {
  afterEach(() => {
    delete process.env.BLUEPRINT_CHART_EDITOR_URL
    delete process.env.MCP_PUBLIC_URL
  })

  it('attaches a scene-0 png preview and urls when both envs are set', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    process.env.MCP_PUBLIC_URL = 'https://mcp.example.com'
    const result = await exportChart({ source: VALID })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.png).toMatch(/^[A-Za-z0-9+/=]+$/)
      expect(result.data.urls?.png).toContain('https://mcp.example.com/render.png?')
      expect(result.data.copyUrl).toContain('/#/copy?bpc64=')
    }
  })

  it('env matrix: EDITOR set + PUBLIC unset → preview yes, urls no', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = await exportChart({ source: VALID })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.png).toBeDefined()
      expect(result.data.urls).toBeUndefined()
    }
  })

  it('exportChartContent emits [image, text] without base64 in the text', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = await exportChart({ source: VALID })
    const formatted = exportChartContent(result)
    expect(formatted.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
    expect((formatted.content[1] as { text: string }).text).toContain('copyUrl')
  })

  it('modelVisible:false adds the user-audience annotation to the preview', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = await exportChart({ source: VALID, modelVisible: false })
    const formatted = exportChartContent(result)
    expect(formatted.content[0]).toMatchObject({ annotations: { audience: ['user'] } })
  })

  it('degrades to URLs-only when the preview render fails', async () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const renderChartModule = await import('../render/renderChart')
    const spy = vi.spyOn(renderChartModule, 'renderChart').mockRejectedValueOnce(new Error('boom'))
    const result = await exportChart({ source: VALID })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.png).toBeUndefined()
      expect(result.data.previewOmitted).toBe(true)
      expect(result.data.copyUrl).toBeDefined()
    }
    spy.mockRestore()
  })
})
