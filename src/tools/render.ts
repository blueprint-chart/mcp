import { z } from 'zod'
import { parseDsl } from '../parse'
import { renderSceneState } from '../render/renderSceneState'
import { rasterizeToPng } from '../render/rasterize'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

export const RenderInputSchema = z.object({
  source: z.string(),
  format: z.enum(['svg', 'png']).default('svg'),
  scene: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().default(800),
  height: z.number().int().positive().default(500),
})
export type RenderInput = z.infer<typeof RenderInputSchema>

export interface RenderOutput {
  svg: string
  png?: string
  mimeType: 'image/svg+xml' | 'image/png'
}

/**
 * `renderSceneState` returns the SVG fragment as produced by jsdom's
 * `outerHTML`, which omits the default SVG namespace. resvg's strict parser
 * rejects that as "the document does not have a root node". Inject the
 * namespace on the way to the rasterizer so the PNG path succeeds.
 */
function ensureSvgNamespace(svg: string): string {
  if (svg.includes('xmlns="http://www.w3.org/2000/svg"')) return svg
  return svg.replace(/^<svg(?=\s|>)/, '<svg xmlns="http://www.w3.org/2000/svg"')
}

/**
 * Composes `parseDsl`, `renderSceneState`, and `rasterizeToPng` into the
 * `render` MCP tool. Always returns SVG; when `format=png`, also includes a
 * base64-encoded PNG. If rasterisation fails we surface `E_RENDER` — the SVG
 * is discarded in that branch to keep the union shape (ToolResult is either
 * ok-with-data or err-with-errors, no partial-success carrier).
 */
export async function renderTool(input: unknown): Promise<ToolResult<RenderOutput>> {
  const parsed = RenderInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const { source, format, scene, width, height } = parsed.data

  const parseResult = parseDsl(source)
  if (!parseResult.ok) return parseResult

  let svg: string
  try {
    svg = renderSceneState(source, { sceneIndex: scene, width, height })
  }
  catch (err) {
    return toolError(ErrorCode.E_RENDER, [
      { path: 'render', message: err instanceof Error ? err.message : String(err) },
    ])
  }

  if (format === 'svg') {
    return toolOk({ svg, mimeType: 'image/svg+xml' })
  }

  try {
    const png = await rasterizeToPng(ensureSvgNamespace(svg), { width })
    return toolOk({ svg, png: png.toString('base64'), mimeType: 'image/png' })
  }
  catch (err) {
    return toolError(ErrorCode.E_RENDER, [
      { path: 'rasterize', message: err instanceof Error ? err.message : String(err) },
    ])
  }
}
