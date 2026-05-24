import { describe, expect, it } from 'vitest'
import { createJsdomEnv } from './jsdomEnv'

describe('createJsdomEnv', () => {
  it('returns a document with an SVG element appended', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    expect(env.container.tagName).toBe('DIV')
    expect(env.container.ownerDocument).toBeDefined()
    expect(env.window.SVGElement).toBeDefined()
  })

  it('serializeSvg() returns bare SVG markup', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    const svg = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 100 100')
    env.container.appendChild(svg)
    const result = env.serializeSvg()
    expect(result).toMatch(/<svg[^>]*viewBox="0 0 100 100"/)
    expect(result).toMatch(/^<svg/)
  })

  it('serializeFrame() returns undefined when no bc-frame is present', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    const svg = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    env.container.appendChild(svg)
    expect(env.serializeFrame()).toBeUndefined()
  })

  it('serializeFrame() returns frame outerHTML when bc-frame is present', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    const frame = env.window.document.createElement('div')
    frame.className = 'bc-frame'
    frame.innerHTML = '<div class="bc-frame-body"><svg></svg></div>'
    env.container.appendChild(frame)
    const result = env.serializeFrame()
    expect(result).toBeDefined()
    expect(result).toContain('<div class="bc-frame"')
    expect(result).toContain('<svg>')
  })

  it('serializeSvg() extracts inner svg from bc-frame-body when frame is present', () => {
    const env = createJsdomEnv({ width: 600, height: 400 })
    const frame = env.window.document.createElement('div')
    frame.className = 'bc-frame'
    const body = env.window.document.createElement('div')
    body.className = 'bc-frame-body'
    const svg = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 200 200')
    body.appendChild(svg)
    frame.appendChild(body)
    env.container.appendChild(frame)
    const result = env.serializeSvg()
    expect(result).toMatch(/^<svg/)
    expect(result).toMatch(/viewBox="0 0 200 200"/)
  })

  it('cleanup() closes the window', () => {
    const env = createJsdomEnv({ width: 100, height: 100 })
    env.cleanup()
    expect(() => env.window.document.createElement('div')).toThrow()
  })
})
