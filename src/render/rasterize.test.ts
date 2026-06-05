import { describe, expect, it } from 'vitest'
import { rasterizeToPng } from './rasterize'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">
  <rect width="100" height="50" fill="red"/>
  <text x="10" y="30" font-size="14" font-family="sans-serif">Hi</text>
</svg>`

describe('rasterizeToPng', () => {
  it('returns a PNG buffer for a valid SVG', async () => {
    const buf = await rasterizeToPng(SVG)
    expect(buf.length).toBeGreaterThan(100)
    // PNG file signature
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
    expect(buf[2]).toBe(0x4e)
    expect(buf[3]).toBe(0x47)
  })

  it('throws on invalid SVG', async () => {
    await expect(rasterizeToPng('not svg at all')).rejects.toThrow()
  })

  it('honors width override', async () => {
    const buf = await rasterizeToPng(SVG, { width: 200 })
    expect(buf.length).toBeGreaterThan(100)
  })

  it('renders text without system fonts (bundled DejaVu only)', async () => {
    const withText = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40">'
      + '<text x="5" y="20" font-family="sans-serif" font-size="14">Hi</text></svg>'
    const noText = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"></svg>'
    const [textPng, blankPng] = await Promise.all([
      rasterizeToPng(withText, { width: 100 }),
      rasterizeToPng(noText, { width: 100 }),
    ])
    // If the bundled font failed to load, resvg silently drops the text and both
    // renders collapse to the same blank canvas — this comparison catches that.
    expect(textPng.length).toBeGreaterThan(blankPng.length)
  })
})
