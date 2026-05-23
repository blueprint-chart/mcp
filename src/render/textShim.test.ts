import { describe, expect, it } from 'vitest'
import { createJsdomEnv } from './jsdomEnv'
import { installTextShim } from './textShim'

describe('textShim', () => {
  it('makes getComputedTextLength return a non-zero value for non-empty text', () => {
    const env = createJsdomEnv({ width: 400, height: 100 })
    installTextShim(env.window)
    const svg = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const text = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.textContent = 'Hello, world'
    text.setAttribute('font-size', '14')
    text.setAttribute('font-family', 'sans-serif')
    svg.appendChild(text)
    env.container.appendChild(svg)
    const length = (text as unknown as SVGTextContentElement).getComputedTextLength()
    expect(length).toBeGreaterThan(0)
  })

  it('getBBox returns width matching getComputedTextLength', () => {
    const env = createJsdomEnv({ width: 400, height: 100 })
    installTextShim(env.window)
    const svg = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const text = env.window.document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.textContent = 'Hi'
    text.setAttribute('font-size', '14')
    svg.appendChild(text)
    env.container.appendChild(svg)
    const bbox = (text as unknown as SVGGraphicsElement).getBBox()
    const length = (text as unknown as SVGTextContentElement).getComputedTextLength()
    expect(bbox.width).toBeCloseTo(length, 0)
  })
})
