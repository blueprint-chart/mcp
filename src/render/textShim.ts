import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { DOMWindow } from 'jsdom'

// Register a bundled font under "sans-serif" so text-width measurements are
// deterministic regardless of which system fonts the host machine has. Without
// this, `ctx.measureText` resolves "sans-serif" through fontconfig and picks
// whatever it finds (DejaVu Sans on Debian/Docker, Noto Sans on Ubuntu CI,
// system fonts on macOS) — and each one yields slightly different metrics,
// breaking golden-render snapshots.
//
// Path resolves correctly both pre-build (tsx running src/) and post-build
// (node running dist/) because the build step copies fonts/ alongside the JS.
const fontsDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fonts')
GlobalFonts.registerFromPath(resolve(fontsDir, 'DejaVuSans.ttf'), 'sans-serif')
GlobalFonts.registerFromPath(resolve(fontsDir, 'DejaVuSans-Bold.ttf'), 'sans-serif')

const canvas = createCanvas(1, 1)
const ctx = canvas.getContext('2d')

function measure(text: string, fontSize: number, fontFamily: string, fontWeight: string) {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  return ctx.measureText(text)
}

function fontFor(el: Element) {
  const fontSize = parseFloat(el.getAttribute('font-size') ?? '12') || 12
  const fontFamily = el.getAttribute('font-family') ?? 'sans-serif'
  const fontWeight = el.getAttribute('font-weight') ?? 'normal'
  return { fontSize, fontFamily, fontWeight }
}

/**
 * Patch jsdom's SVG element prototypes so D3 layout primitives that rely on
 * text measurement (axes, legends, annotations) return realistic widths.
 *
 * jsdom 26 does not expose `SVGTextContentElement` and does not subclass
 * `<svg:text>` from `SVGGraphicsElement` — text elements are plain
 * `SVGElement` instances. We therefore patch `SVGElement.prototype` so the
 * methods exist on the actual prototype chain, while also patching the
 * spec-correct prototypes if they happen to be available.
 */
export function installTextShim(window: DOMWindow): void {
  const svgElementProto = window.SVGElement?.prototype as
    | (SVGElement & {
      getComputedTextLength?: () => number
      getSubStringLength?: (offset: number, count: number) => number
      getBBox?: () => DOMRect
    })
    | undefined

  const computedTextLength = function (this: SVGElement) {
    const { fontSize, fontFamily, fontWeight } = fontFor(this)
    return measure(this.textContent ?? '', fontSize, fontFamily, fontWeight).width
  }

  const subStringLength = function (this: SVGElement, offset: number, count: number) {
    const txt = (this.textContent ?? '').substring(offset, offset + count)
    const { fontSize, fontFamily, fontWeight } = fontFor(this)
    return measure(txt, fontSize, fontFamily, fontWeight).width
  }

  const getBBox = function (this: SVGElement) {
    if (this.tagName === 'text') {
      const { fontSize, fontFamily, fontWeight } = fontFor(this)
      const m = measure(this.textContent ?? '', fontSize, fontFamily, fontWeight)
      return { x: 0, y: -fontSize, width: m.width, height: fontSize } as DOMRect
    }
    // For non-text elements, fall back to declared attrs.
    const x = parseFloat(this.getAttribute('x') ?? '0') || 0
    const y = parseFloat(this.getAttribute('y') ?? '0') || 0
    const width = parseFloat(this.getAttribute('width') ?? '0') || 0
    const height = parseFloat(this.getAttribute('height') ?? '0') || 0
    return { x, y, width, height } as DOMRect
  }

  if (svgElementProto) {
    svgElementProto.getComputedTextLength = computedTextLength
    svgElementProto.getSubStringLength = subStringLength
    svgElementProto.getBBox = getBBox
  }

  // Spec-correct prototypes — patch when jsdom (or a future version) exposes them.
  const textContentProto = (window as unknown as { SVGTextContentElement?: { prototype: SVGTextContentElement } })
    .SVGTextContentElement?.prototype
  if (textContentProto) {
    textContentProto.getComputedTextLength = computedTextLength as typeof textContentProto.getComputedTextLength
    textContentProto.getSubStringLength = subStringLength as typeof textContentProto.getSubStringLength
  }

  const graphicsProto = window.SVGGraphicsElement?.prototype
  if (graphicsProto) {
    graphicsProto.getBBox = getBBox as typeof graphicsProto.getBBox
  }
}
