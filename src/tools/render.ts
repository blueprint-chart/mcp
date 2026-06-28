import { z } from 'zod'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative as relativePath, resolve as resolvePath, sep } from 'node:path'
import type { FrameMetadata } from '../render/frame'
import { MAX_RENDER_DIMENSION, renderChart } from '../render/renderChart'
import { getPublicBaseUrl } from '../links/editorConfig'
import { buildRenderUrls, type RenderUrls } from '../links/buildUrls'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'
import { formatToolResult, type FormattedToolResult } from '../toolContent'
import { FrameMetadataSchema, RenderUrlsSchema } from './outputSchemas'

export const RenderOutputSchema = z.object({
  frame: FrameMetadataSchema.describe('Frame metadata extracted from the chart.'),
  mimeType: z.enum(['image/svg+xml', 'image/png', 'text/html']).describe('MIME type of the rendered output.'),
  savedTo: z.string().optional().describe('Absolute path the output was written to, when `save` was used.'),
  urls: RenderUrlsSchema.optional().describe('Stateless hosted render URLs (only when MCP_PUBLIC_URL is set).'),
  urlsOmitted: z.literal('source-too-large').optional().describe('Set when URLs were omitted because the source exceeded the URL cap.'),
})

export const RenderInputSchema = z.object({
  source: z.string().describe('The .bpc chart source to render.'),
  format: z.enum(['svg', 'png', 'html']).default('svg').describe('Output format. "svg" (default) and "html" return text; "png" returns an inline image you and the user can both see.'),
  scene: z.number().int().nonnegative().optional().describe('Zero-based scene index to render, for charts that define scenes. Omit for the base chart (scene 0).'),
  width: z.number().int().positive().max(MAX_RENDER_DIMENSION).default(800).describe('Output width in pixels (max 1600). PNGs are rasterized at 2x for retina sharpness.'),
  height: z.number().int().positive().max(MAX_RENDER_DIMENSION).default(500).describe('Output height in pixels (max 1600).'),
  modelVisible: z.boolean().default(true).describe('When false, the inline PNG is shown to the user but not sent to the model (saves image tokens on bulk renders).'),
  save: z.string().optional().describe('Optional output path, always resolved inside MCP_FS_WRITE_DIR (relative paths are joined to it; absolute paths are re-anchored under it). When set, the output is written to disk and omitted from the response. Requires MCP_FS_WRITE_DIR.'),
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
  /** Stateless hosted render URLs — present when MCP_PUBLIC_URL is set. */
  urls?: RenderUrls
  urlsOmitted?: 'source-too-large'
  /** Echoed for the content formatter; stripped from the text block. */
  modelVisible?: boolean
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
  ok: Omit<RenderOutput, 'svg' | 'png' | 'html' | 'savedTo' | 'modelVisible'>,
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

function publicUrls(source: string, opts: { width: number, height: number, scene?: number }):
Pick<RenderOutput, 'urls' | 'urlsOmitted'> {
  const base = getPublicBaseUrl()
  if (!base) {
    return {}
  }
  const urls = buildRenderUrls(source, opts, base)
  return urls ? { urls } : { urlsOmitted: 'source-too-large' }
}

export async function renderTool(input: unknown): Promise<ToolResult<RenderOutput>> {
  const parsed = RenderInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const { source, format, scene, width, height, save, modelVisible } = parsed.data

  let saveAbsPath: string | undefined
  if (save !== undefined) {
    const resolved = resolveSavePath(save)
    if (!resolved.ok) {
      return toolError(ErrorCode.E_INPUT, [{ code: resolved.code, path: 'save', message: resolved.message }])
    }
    saveAbsPath = resolved.absPath
  }

  const rendered = await renderChart(source, { format, scene, width, height })
  if (!rendered.ok) {
    return rendered.error
  }
  const { body, contentType, frame } = rendered
  const links = publicUrls(source, { width, height, scene })

  if (saveAbsPath !== undefined) {
    return finishSave(saveAbsPath, body, { frame, mimeType: contentType, ...links })
  }

  if (format === 'svg') {
    return toolOk({ svg: body as string, frame, mimeType: 'image/svg+xml' as const, ...links })
  }
  if (format === 'html') {
    return toolOk({ html: body as string, frame, mimeType: 'text/html' as const, ...links })
  }
  return toolOk({
    png: (body as Buffer).toString('base64'),
    frame,
    mimeType: 'image/png' as const,
    modelVisible,
    ...links,
  })
}

/**
 * Content formatter for the TOOLS registry — colocated with the tool. PNG
 * results become [image block, text metadata]; the base64 NEVER enters the
 * text block. Everything else falls through to the default text formatter.
 */
export function renderToolContent(result: ToolResult<RenderOutput>): FormattedToolResult {
  if (!result.ok) {
    return formatToolResult(result)
  }
  const { svg: _svg, png: _png, html: _html, modelVisible: _mv, ...meta } = result.data
  if (result.data.png === undefined) {
    // SVG / HTML: keep the existing text content from formatToolResult, override structuredContent.
    return { ...formatToolResult(result), structuredContent: meta }
  }
  const { png, modelVisible, ...textPayload } = result.data
  return {
    content: [
      {
        type: 'image',
        data: png,
        mimeType: 'image/png',
        ...(modelVisible === false ? { annotations: { audience: ['user' as const] } } : {}),
      },
      { type: 'text', text: JSON.stringify(textPayload, null, 2) },
    ],
    structuredContent: meta,
  }
}
