import { z } from 'zod'
import { parseDsl } from '../parse'
import { validateAst } from '../dsl/validate'
import { diagnoseRender } from '../render/diagnose'
import { renderSceneState } from '../render/renderSceneState'
import { rasterizeToPng } from '../render/rasterize'
import { ErrorCode, toolError, toolOk, type ToolErrorEntry, type ToolResult } from '../errors'

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

function ensureSvgNamespace(svg: string): string {
  if (svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return svg
  }
  return svg.replace(/^<svg(?=\s|>)/, '<svg xmlns="http://www.w3.org/2000/svg"')
}

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
  if (!parseResult.ok) {
    return parseResult
  }

  // Layer 1: semantic validation (chart type, properties, empty data).
  const issues = validateAst(parseResult.data.ast)
  if (issues.length > 0) {
    const entries: ToolErrorEntry[] = issues.map(i => ({
      code: i.code,
      path: i.path,
      message: i.message,
      suggestion: i.suggestion,
      context: i.context,
    }))
    return toolError(ErrorCode.E_SEMANTIC, entries)
  }

  // Layer 2: render-state diagnostic (colorize/highlight resolution, scene index).
  const diag = diagnoseRender(source, { sceneIndex: scene })
  if (!diag.ok) {
    const entries: ToolErrorEntry[] = diag.diagnostics.map(d => ({
      code: d.code,
      path: d.path,
      message: d.message,
      suggestion: d.suggestion,
      context: d.context,
    }))
    return toolError(ErrorCode.E_RENDER, entries)
  }

  // Layer 3: actual render.
  let svg: string
  try {
    svg = renderSceneState(source, { sceneIndex: scene, width, height })
  }
  catch (err) {
    return toolError(ErrorCode.E_RENDER, [{
      code: 'E_RENDER_UNKNOWN',
      path: 'render',
      message: err instanceof Error ? err.message : String(err),
    }])
  }

  if (format === 'svg') {
    return toolOk({ svg, mimeType: 'image/svg+xml' })
  }

  try {
    const png = await rasterizeToPng(ensureSvgNamespace(svg), { width })
    return toolOk({ svg, png: png.toString('base64'), mimeType: 'image/png' })
  }
  catch (err) {
    return toolError(ErrorCode.E_RENDER, [{
      code: 'E_RASTERIZE',
      path: 'rasterize',
      message: err instanceof Error ? err.message : String(err),
    }])
  }
}
