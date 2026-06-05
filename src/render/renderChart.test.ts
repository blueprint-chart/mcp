import { describe, expect, it } from 'vitest'
import { MAX_RENDER_DIMENSION, RASTER_SCALE, clampDimension, renderChart } from './renderChart'
import { ErrorCode } from '../errors'

const VALID = 'chart bar-vertical {\n  title = "Hi"\n  data {\n    "A" = 1\n  }\n}\n'

function pngSize(buf: Buffer): { width: number, height: number } {
  // PNG IHDR: width at byte 16, height at byte 20, big-endian uint32
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe('clampDimension', () => {
  it('floors, lower-bounds at 1, upper-bounds at MAX_RENDER_DIMENSION', () => {
    expect(clampDimension(0)).toBe(1)
    expect(clampDimension(800.9)).toBe(800)
    expect(clampDimension(5000)).toBe(MAX_RENDER_DIMENSION)
    expect(clampDimension(Number.NaN)).toBe(1)
    expect(clampDimension(Number.POSITIVE_INFINITY)).toBe(MAX_RENDER_DIMENSION)
  })
})

describe('renderChart', () => {
  it('renders svg with the xmlns namespace present', async () => {
    const r = await renderChart(VALID, { format: 'svg', width: 800, height: 500 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.contentType).toBe('image/svg+xml')
      expect(String(r.body)).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(r.frame.title).toBe('Hi')
    }
  })

  it('renders png at RASTER_SCALE× requested width, capped at MAX_RENDER_DIMENSION', async () => {
    const r = await renderChart(VALID, { format: 'png', width: 400, height: 250 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.contentType).toBe('image/png')
      expect(pngSize(r.body as Buffer).width).toBe(400 * RASTER_SCALE)
    }
    const capped = await renderChart(VALID, { format: 'png', width: 1200, height: 750 })
    expect(capped.ok).toBe(true)
    if (capped.ok) {
      expect(pngSize(capped.body as Buffer).width).toBe(MAX_RENDER_DIMENSION) // 2×1200 capped
    }
  })

  it('renders html', async () => {
    const r = await renderChart(VALID, { format: 'html', width: 800, height: 500 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.contentType).toBe('text/html')
    }
  })

  it('propagates pipeline errors with structured codes', async () => {
    const r = await renderChart('chart bar-vertical {', { format: 'svg', width: 800, height: 500 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe(ErrorCode.E_PARSE)
    }
  })

  it('rejects charts above the complexity ceiling with E_TOO_COMPLEX', async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => `  "0r${i}" = ${i}`).join('\n')
    const huge = `chart bar-vertical {\n  data {\n${rows}\n  }\n}\n`
    const r = await renderChart(huge, { format: 'svg', width: 800, height: 500 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe(ErrorCode.E_RENDER)
      expect(r.error.errors[0]?.code).toBe('E_TOO_COMPLEX')
    }
  })
})
