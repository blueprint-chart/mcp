import { describe, expect, it } from 'vitest'
import { createJsdomEnv } from './jsdomEnv'

describe('createJsdomEnv', () => {
  it('returns a document with an SVG element appended', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    expect(env.container.tagName).toBe('DIV')
    expect(env.container.ownerDocument).toBeDefined()
    expect(env.window.SVGElement).toBeDefined()
  })

  it('exposes a serialize() that returns SVG markup', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    const svg = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 100 100')
    env.container.appendChild(svg)
    expect(env.serialize()).toMatch(/<svg[^>]*viewBox="0 0 100 100"/)
  })

  it('cleanup() closes the window', () => {
    const env = createJsdomEnv({ width: 100, height: 100 })
    env.cleanup()
    expect(() => env.window.document.createElement('div')).toThrow()
  })
})
