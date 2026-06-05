import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

// Same bundled fonts the text-measurement shim registers (textShim.ts) — the
// rasterizer and the layout pass now agree on metrics, and resvg no longer
// scans system fonts on every call (eng review D9). The build script copies
// fonts/ into dist/render/ and asserts the copy, so this resolves in dist/ too.
const FONTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fonts')

export interface RasterizeOptions {
  width?: number
  height?: number
}

export async function rasterizeToPng(svg: string, opts: RasterizeOptions = {}): Promise<Buffer> {
  const fitTo = opts.width
    ? ({ mode: 'width', value: opts.width } as const)
    : opts.height
      ? ({ mode: 'height', value: opts.height } as const)
      : ({ mode: 'original' } as const)
  const resvg = new Resvg(svg, {
    fitTo,
    font: {
      fontDirs: [FONTS_DIR],
      loadSystemFonts: false,
      defaultFontFamily: 'DejaVu Sans',
    },
  })
  const image = resvg.render()
  return Buffer.from(image.asPng())
}
