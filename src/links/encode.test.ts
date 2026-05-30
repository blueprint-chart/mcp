import { describe, it, expect } from 'vitest'
import { samples } from '@blueprint-chart/lib'
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

describe('letter-frequency golden link', () => {
  // The url-safe base64 of the letter-frequency sample, as hardcoded in the
  // editor's LandingMcp.vue (`/#/copy?bpc64=<this>`). MCP output must match exactly.
  const LANDING_B64 = 'Y2hhcnQgYmFyLXZlcnRpY2FsIHsKICB0aXRsZSA9ICJFIGlzIHRoZSBtb3N0IGZyZXF1ZW50IGxldHRlciBpbiBFbmdsaXNoIgogIGRlc2NyaXB0aW9uID0gIkhvdyBvZnRlbiBlYWNoIGxldHRlciBhcHBlYXJzIGluIHR5cGljYWwgRW5nbGlzaCB0ZXh0IgogIGJ5bGluZSA9ICJQaWVycmUgUm9tZXJhIgogIHNvdXJjZSA9ICJMZXdhbmQsIENyeXB0b2xvZ2ljYWwgTWF0aGVtYXRpY3MiCiAgc291cmNlVXJsID0gImh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0xldHRlcl9mcmVxdWVuY3kiCiAgbm90ZSA9ICJCYXNlZCBvbiBhbmFseXNpcyBvZiA0MCwwMDAgd29yZHMgZnJvbSBFbmdsaXNoIHByb3NlIgogIGNvbG9yUGFsZXR0ZSA9ICJMb25kb24iCiAgc29ydCA9IGRlc2NlbmRpbmcKICB2YWx1ZUxhYmVscyA9IHRydWUKICB2ZXJ0aWNhbExhYmVsUG9zaXRpb24gPSBvZmYKICB2ZXJ0aWNhbEdyaWRTdHlsZSA9IG5vbmUKCiAgaGlnaGxpZ2h0ICJFIgoKICBkYXRhIHsKICAgICJFIiA9IDEyLjcwCiAgICAiVCIgPSA5LjA2CiAgICAiQSIgPSA4LjE3CiAgICAiTyIgPSA3LjUxCiAgICAiSSIgPSA2Ljk3CiAgICAiTiIgPSA2Ljc1CiAgICAiUyIgPSA2LjMzCiAgICAiSCIgPSA2LjA5CiAgICAiUiIgPSA1Ljk5CiAgICAiRCIgPSA0LjI1CiAgfQp9Cg'

  it('matches the editor landing-page copy link byte-for-byte', () => {
    const sample = samples.find(s => s.id === 'letter-frequency')
    expect(sample).toBeDefined()
    expect(toUrlSafeB64(sample!.dsl)).toBe(LANDING_B64)
  })
})
