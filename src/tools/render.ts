import { z } from 'zod'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative as relativePath, resolve as resolvePath, sep } from 'node:path'
import { extractFrameMetadata, type FrameMetadata } from '../render/frame'
import { renderSceneState } from '../render/renderSceneState'
import { rasterizeToPng } from '../render/rasterize'
import { validatePipeline } from '../render/validatePipeline'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

export const RenderInputSchema = z.object({
  source: z.string(),
  format: z.enum(['svg', 'png', 'html']).default('svg'),
  scene: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().default(800),
  height: z.number().int().positive().default(500),
  /** Optional file path for the output. Always resolved inside MCP_FS_WRITE_DIR: relative paths are joined to it, and absolute paths are re-anchored under it (e.g. `/tmp/x.png` → `<dir>/tmp/x.png`), so any value lands in the sandbox. When provided, the primary output (PNG bytes / SVG / HTML) is written there and the inline content is omitted from the response. Requires MCP_FS_WRITE_DIR to be set; only `../` traversal that escapes the directory is rejected. */
  save: z.string().optional(),
})
export type RenderInput = z.infer<typeof RenderInputSchema>

export interface RenderOutput {
  svg?: string
  png?: string
  html?: string
  frame: FrameMetadata
  mimeType: 'image/svg+xml' | 'image/png' | 'text/html'
  /** When `save` was used, the resolved absolute path the output was written to. Inline content fields (svg/png/html) are omitted. */
  savedTo?: string
}

/** Returns the configured sandbox root (absolute), or null when file saving is disabled. */
function getJailRoot(): string | null {
  const raw = process.env.MCP_FS_WRITE_DIR?.trim()
  if (!raw) {
    return null
  }
  return resolvePath(raw)
}

type SaveResolution =
  | { ok: true, absPath: string }
  | { ok: false, code: string, message: string }

/**
 * True when `target` (an already-resolved absolute path) is not a writable location
 * strictly inside `jail`. Covers the jail root itself (rel === '', e.g. "" or "."),
 * parent-directory traversal, and any path on a different root.
 */
function escapesJail(jail: string, target: string): boolean {
  const rel = relativePath(jail, target)
  return rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
}

/**
 * Resolve `save` to an absolute path confined to the sandbox root. The sandbox is the
 * single source of truth for where files land:
 * - a relative path, or an absolute path already inside the jail, is used as-is;
 * - any other absolute path (one that would land outside the jail) is re-anchored
 *   *as if it were jail-relative* by stripping its leading separators and joining the
 *   remainder under the jail — so `/tmp/foo.png` becomes `<jail>/tmp/foo.png`;
 * - a path that still escapes via `..` traversal after re-anchoring is rejected.
 */
function resolveSavePath(save: string): SaveResolution {
  const jail = getJailRoot()
  if (jail === null) {
    return {
      ok: false,
      code: 'E_FS_WRITE_DISABLED',
      message: 'File saving is disabled. Set MCP_FS_WRITE_DIR=<dir> to enable and confine writes to that directory.',
    }
  }
  let absPath = resolvePath(jail, save)
  if (escapesJail(jail, absPath)) {
    // Re-anchor under the jail by dropping leading separators so the path is treated as
    // jail-relative. `..` segments survive normalization, so genuine traversal is still caught.
    const reanchored = save.replace(/^[/\\]+/, '')
    absPath = resolvePath(jail, reanchored)
    if (escapesJail(jail, absPath)) {
      return {
        ok: false,
        code: 'E_FS_WRITE_ESCAPE',
        message: `save path "${save}" escapes the configured MCP_FS_WRITE_DIR sandbox (${jail}) via parent-directory traversal.`,
      }
    }
  }
  return { ok: true, absPath }
}

async function trySave(absPath: string, body: string | Buffer): Promise<{ savedTo: string } | { error: string }> {
  try {
    await mkdir(dirname(absPath), { recursive: true })
    await writeFile(absPath, body)
    return { savedTo: absPath }
  }
  catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/** Write `body` to `absPath` and build the success result, or return a save-failed tool error. */
async function finishSave(
  absPath: string,
  body: string | Buffer,
  ok: Omit<RenderOutput, 'svg' | 'png' | 'html' | 'savedTo'>,
): Promise<ToolResult<RenderOutput>> {
  const result = await trySave(absPath, body)
  if ('error' in result) {
    return toolError(ErrorCode.E_RENDER, [{
      code: 'E_SAVE_FAILED',
      path: 'save',
      message: result.error,
    }])
  }
  return toolOk({ ...ok, savedTo: result.savedTo })
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
  const { source, format, scene, width, height, save } = parsed.data

  let saveAbsPath: string | undefined
  if (save !== undefined) {
    const resolved = resolveSavePath(save)
    if (!resolved.ok) {
      return toolError(ErrorCode.E_INPUT, [{
        code: resolved.code,
        path: 'save',
        message: resolved.message,
      }])
    }
    saveAbsPath = resolved.absPath
  }

  const validated = validatePipeline(source, { sceneIndex: scene })
  if (!validated.ok) {
    return validated.error
  }

  const frame = extractFrameMetadata(validated.ast)

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
    if (saveAbsPath !== undefined) {
      return finishSave(saveAbsPath, svg, { frame, mimeType: 'image/svg+xml' })
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
    if (saveAbsPath !== undefined) {
      return finishSave(saveAbsPath, html, { frame, mimeType: 'text/html' })
    }
    return toolOk({ svg, html, frame, mimeType: 'text/html' })
  }

  // format === 'png'
  try {
    const png = await rasterizeToPng(ensureSvgNamespace(svg), { width })
    if (saveAbsPath !== undefined) {
      return finishSave(saveAbsPath, png, { frame, mimeType: 'image/png' })
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
