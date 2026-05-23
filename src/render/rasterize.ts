import { Resvg } from '@resvg/resvg-js'

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
    font: { loadSystemFonts: true },
  })
  const image = resvg.render()
  return Buffer.from(image.asPng())
}
