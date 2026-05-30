import { describe, it, expect, afterEach } from 'vitest'
import { exportChart } from './exportChart'
import { ErrorCode } from '../errors'

const VALID = 'chart bar-vertical {\n  title = "Hi"\n  data {\n    "A" = 1\n  }\n}\n'

afterEach(() => {
  delete process.env.BLUEPRINT_CHART_EDITOR_URL
})

describe('exportChart', () => {
  it('returns E_CONFIG when the editor base URL is unset', () => {
    const result = exportChart({ source: VALID })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_CONFIG)
      expect(result.errors[0]?.message).toMatch(/BLUEPRINT_CHART_EDITOR_URL/)
    }
  })

  it('returns E_INPUT when source is missing', () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = exportChart({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_INPUT)
    }
  })

  it('propagates E_PARSE from the shared validation pipeline', () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = exportChart({ source: 'chart bar-vertical {' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.E_PARSE)
    }
  })

  it('returns copy + embed URLs and frame for a valid source', () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
    const result = exportChart({ source: VALID })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.copyUrl).toMatch(/^https:\/\/blueprintchart\.com\/#\/copy\?bpc64=/)
      expect(result.data.embedUrl).toMatch(/^https:\/\/blueprintchart\.com\/#\/render\?bpc64=/)
      expect(result.data.frame.title).toBe('Hi')
    }
  })
})
