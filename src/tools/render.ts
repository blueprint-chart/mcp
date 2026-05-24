import { z } from 'zod'
import { writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { ChartNode } from '@blueprint-chart/lib'
import { parseDsl } from '../parse'
import { validateAst } from '../dsl/validate'
import { diagnoseRender } from '../render/diagnose'
import { renderSceneState } from '../render/renderSceneState'
import { rasterizeToPng } from '../render/rasterize'
import { ErrorCode, toolError, toolOk, type ToolErrorEntry, type ToolResult } from '../errors'

export const RenderInputSchema = z.object({
  source: z.string(),
  format: z.enum(['svg', 'png', 'html']).default('svg'),
  scene: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().default(800),
  height: z.number().int().positive().default(500),
  /** Optional file path (absolute, or relative to MCP server CWD). When provided, the primary output (PNG bytes / SVG / HTML) is written to that path and the inline content is omitted from the response. Requires MCP_ALLOW_FS_WRITE=1. */
  save: z.string().optional(),
})
export type RenderInput = z.infer<typeof RenderInputSchema>

export interface RenderOutput {
  svg?: string
  png?: string
  html?: string
  frame: {
    title?: string
    description?: string
    byline?: string
    source?: string
    sourceUrl?: string
    note?: string
  }
  mimeType: 'image/svg+xml' | 'image/png' | 'text/html'
  /** When `save` was used, the resolved absolute path the output was written to. Inline content fields (svg/png/html) are omitted. */
  savedTo?: string
}

function isFsWriteEnabled(): boolean {
  const v = process.env.MCP_ALLOW_FS_WRITE
  return v === '1' || v === 'true' || v === 'yes'
}

async function trySave(absPath: string, body: string | Buffer): Promise<{ savedTo: string } | { error: string }> {
  try {
    await writeFile(absPath, body)
    return { savedTo: absPath }
  }
  catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

function ensureSvgNamespace(svg: string): string {
  if (svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return svg
  }
  return svg.replace(/^<svg(?=\s|>)/, '<svg xmlns="http://www.w3.org/2000/svg"')
}

const FRAME_KEYS = ['title', 'description', 'byline', 'source', 'sourceUrl', 'note'] as const

function extractFrameMetadata(ast: ChartNode): RenderOutput['frame'] {
  const frame: RenderOutput['frame'] = {}
  for (const prop of ast.properties ?? []) {
    if ((FRAME_KEYS as readonly string[]).includes(prop.key)) {
      frame[prop.key as keyof typeof frame] = String(prop.value).replace(/^"|"$/g, '')
    }
  }
  return frame
}

export async function renderTool(input: unknown): Promise<ToolResult<RenderOutput>> {
  const parsed = RenderInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const { source, format, scene, width, height, save } = parsed.data

  if (save !== undefined && !isFsWriteEnabled()) {
    return toolError(ErrorCode.E_INPUT, [{
      code: 'E_FS_WRITE_DISABLED',
      path: 'save',
      message: 'File saving is disabled. Set MCP_ALLOW_FS_WRITE=1 to enable. This is typically only safe in local stdio mode.',
    }])
  }

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

  const frame = extractFrameMetadata(parseResult.data.ast)

  // Layer 3: actual render.
  let svg: string
  let html: string | undefined
  try {
    const result = renderSceneState(source, { sceneIndex: scene, width, height })
    svg = result.svg
    html = result.html
  }
  catch (err) {
    return toolError(ErrorCode.E_RENDER, [{
      code: 'E_RENDER_UNKNOWN',
      path: 'render',
      message: err instanceof Error ? err.message : String(err),
    }])
  }

  if (format === 'svg') {
    if (save !== undefined) {
      const absPath = resolvePath(save)
      const result = await trySave(absPath, svg)
      if ('error' in result) {
        return toolError(ErrorCode.E_RENDER, [{
          code: 'E_SAVE_FAILED',
          path: 'save',
          message: result.error,
        }])
      }
      return toolOk({ frame, mimeType: 'image/svg+xml', savedTo: result.savedTo })
    }
    return toolOk({ svg, frame, mimeType: 'image/svg+xml' })
  }

  if (format === 'html') {
    if (!html) {
      return toolError(ErrorCode.E_RENDER, [{
        code: 'E_FRAME_UNAVAILABLE',
        path: 'render',
        message: 'HTML frame was not produced by the renderer',
      }])
    }
    if (save !== undefined) {
      const absPath = resolvePath(save)
      const result = await trySave(absPath, html)
      if ('error' in result) {
        return toolError(ErrorCode.E_RENDER, [{
          code: 'E_SAVE_FAILED',
          path: 'save',
          message: result.error,
        }])
      }
      return toolOk({ frame, mimeType: 'text/html', savedTo: result.savedTo })
    }
    return toolOk({ svg, html, frame, mimeType: 'text/html' })
  }

  // format === 'png'
  try {
    const png = await rasterizeToPng(ensureSvgNamespace(svg), { width })
    if (save !== undefined) {
      const absPath = resolvePath(save)
      const result = await trySave(absPath, png)
      if ('error' in result) {
        return toolError(ErrorCode.E_RENDER, [{
          code: 'E_SAVE_FAILED',
          path: 'save',
          message: result.error,
        }])
      }
      return toolOk({ frame, mimeType: 'image/png', savedTo: result.savedTo })
    }
    return toolOk({ svg, png: png.toString('base64'), frame, mimeType: 'image/png' })
  }
  catch (err) {
    return toolError(ErrorCode.E_RENDER, [{
      code: 'E_RASTERIZE',
      path: 'rasterize',
      message: err instanceof Error ? err.message : String(err),
    }])
  }
}
