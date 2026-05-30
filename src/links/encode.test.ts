import { describe, it, expect } from 'vitest'
import { toUrlSafeB64, toStandardB64 } from './encode'

/** Decode a url-safe, unpadded base64 string back to UTF-8 (mirrors the editor's /copy decoder). */
function decodeUrlSafe(raw: string): string {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64').toString('utf8')
}

describe('toUrlSafeB64', () => {
  it('encodes ASCII with no padding and a url-safe alphabet', () => {
    const out = toUrlSafeB64('chart bar-vertical {\n}\n')
    expect(out).toBe('Y2hhcnQgYmFyLXZlcnRpY2FsIHsKfQo')
    expect(out).not.toContain('=')
    expect(out).not.toMatch(/[+/]/)
  })

  it('round-trips non-ASCII (en dash, euro) through UTF-8', () => {
    const src = 'Price – €5'
    expect(toUrlSafeB64(src)).toBe('UHJpY2Ug4oCTIOKCrDU')
    expect(decodeUrlSafe(toUrlSafeB64(src))).toBe(src)
  })
})

describe('toStandardB64', () => {
  it('encodes with standard alphabet and padding (atob-compatible)', () => {
    expect(toStandardB64('chart bar-vertical {\n}\n')).toBe('Y2hhcnQgYmFyLXZlcnRpY2FsIHsKfQo=')
  })
})
