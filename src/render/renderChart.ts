import type { ChartNode } from '@blueprint-chart/lib'
import { validatePipeline } from './validatePipeline'
import { extractFrameMetadata, type FrameMetadata } from './frame'
import { renderSceneState } from './renderSceneState'
import { rasterizeToPng } from './rasterize'
import { ErrorCode, toolError, type ToolErrorEntry, type ToolResult } from '../errors'

/** Single source of truth for output dimensions (eng review D7). */
export const MAX_RENDER_DIMENSION = 1600
/** Inline/URL PNGs are rasterized at 2× for retina displays (capped above). */
export const RASTER_SCALE = 2

/** Complexity ceiling (eng review D9): reject pathological charts pre-render. */
export const MAX_DATA_ENTRIES = 5000
export const MAX_SCENES = 20

export type RenderChartFormat = 'svg' | 'png' | 'html'

export interface RenderChartOptions {
  format: RenderChartFormat
  scene?: number
  width: number
  height: number
}

export type RenderChartResult =
  | { ok: true, body: string | Buffer, contentType: 'image/svg+xml' | 'image/png' | 'text/html', frame: FrameMetadata }
  | { ok: false, error: Extract<ToolResult<never>, { ok: false }> }

export function clampDimension(value: number): number {
  return Math.min(Math.max(1, Math.floor(value)), MAX_RENDER_DIMENSION)
}

/** Moved verbatim from tools/render.ts — resvg requires the namespace. */
function ensureSvgNamespace(svg: string): string {
  if (svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return svg
  }
  return svg.replace(/^<svg(?=\s|>)/, '<svg xmlns="http://www.w3.org/2000/svg"')
}

/** Same AST accessors as tools/inspect.ts `summarizeData`/`summarizeScenes`. */
function checkComplexity(ast: ChartNode): ToolErrorEntry | undefined {
  const entryCount = ast.data?.entries?.length ?? 0
  if (entryCount > MAX_DATA_ENTRIES) {
    return {
      code: 'E_TOO_COMPLEX',
      path: 'data',
      message: `data block has ${entryCount} entries; the render ceiling is ${MAX_DATA_ENTRIES}`,
      suggestion: 'Aggregate or sample the data before charting.',
    }
  }
  const sceneCount = ast.scenes?.length ?? 0
  if (sceneCount > MAX_SCENES) {
    return {
      code: 'E_TOO_COMPLEX',
      path: 'scenes',
      message: `chart has ${sceneCount} scenes; the render ceiling is ${MAX_SCENES}`,
      suggestion: 'Split the story into multiple charts.',
    }
  }
  return undefined
}

/**
 * THE render pipeline. Both the `render`/`export_chart` tools and the HTTP
 * /render.* endpoints call this — rendering behavior cannot drift between
 * them (eng review D4). Dimension and retina policy live here only (D7).
 */
export async function renderChart(source: string, opts: RenderChartOptions): Promise<RenderChartResult> {
  const validated = validatePipeline(source, { sceneIndex: opts.scene })
  if (!validated.ok) {
    return { ok: false, error: validated.error }
  }

  const tooComplex = checkComplexity(validated.ast)
  if (tooComplex) {
    return { ok: false, error: toolError(ErrorCode.E_RENDER, [tooComplex]) }
  }

  const frame = extractFrameMetadata(validated.ast)
  const width = clampDimension(opts.width)
  const height = clampDimension(opts.height)

  let svg: string
  let html: string | undefined
  try {
    const result = renderSceneState(source, { sceneIndex: opts.scene, width, height })
    svg = ensureSvgNamespace(result.svg)
    html = result.html
  }
  catch (err) {
    return {
      ok: false,
      error: toolError(ErrorCode.E_RENDER, [{
        code: 'E_RENDER_UNKNOWN',
        path: 'render',
        message: err instanceof Error ? err.message : String(err),
      }]),
    }
  }

  if (opts.format === 'svg') {
    return { ok: true, body: svg, contentType: 'image/svg+xml', frame }
  }

  if (opts.format === 'html') {
    if (!html) {
      return {
        ok: false,
        error: toolError(ErrorCode.E_RENDER, [{
          code: 'E_FRAME_UNAVAILABLE',
          path: 'render',
          message: 'HTML frame was not produced by the renderer',
        }]),
      }
    }
    return { ok: true, body: html, contentType: 'text/html', frame }
  }

  try {
    const rasterWidth = Math.min(width * RASTER_SCALE, MAX_RENDER_DIMENSION)
    const png = await rasterizeToPng(svg, { width: rasterWidth })
    return { ok: true, body: png, contentType: 'image/png', frame }
  }
  catch (err) {
    return {
      ok: false,
      error: toolError(ErrorCode.E_RENDER, [{
        code: 'E_RASTERIZE',
        path: 'rasterize',
        message: err instanceof Error ? err.message : String(err),
      }]),
    }
  }
}
