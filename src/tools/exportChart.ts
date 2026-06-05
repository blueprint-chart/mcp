import { z } from 'zod'
import { getEditorBaseUrl, getPublicBaseUrl } from '../links/editorConfig'
import { buildCopyUrl, buildEmbedUrl, buildRenderUrls, type RenderUrls } from '../links/buildUrls'
import { validatePipeline } from '../render/validatePipeline'
import { extractFrameMetadata, type FrameMetadata } from '../render/frame'
import { renderChart } from '../render/renderChart'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'
import { formatToolResult, type FormattedToolResult } from '../toolContent'

const PREVIEW_WIDTH = 800
const PREVIEW_HEIGHT = 500

export const ExportChartInputSchema = z.object({
  source: z.string(),
  /** When false, the preview image is marked audience:["user"]. */
  modelVisible: z.boolean().default(true),
}).strict()
export type ExportChartInput = z.infer<typeof ExportChartInputSchema>

export interface ExportChartOutput {
  copyUrl: string
  embedUrl: string
  frame: FrameMetadata
  /** Scene-0 PNG preview (base64) — omitted if the preview render failed. */
  png?: string
  previewOmitted?: true
  urls?: RenderUrls
  modelVisible?: boolean
}

export async function exportChart(input: unknown): Promise<ToolResult<ExportChartOutput>> {
  const parsed = ExportChartInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }

  const editorBase = getEditorBaseUrl()
  if (!editorBase) {
    return toolError(ErrorCode.E_CONFIG, [{
      code: 'E_EDITOR_URL_UNSET',
      message: 'Link export is not configured. Set BLUEPRINT_CHART_EDITOR_URL to enable.',
    }])
  }

  const validated = validatePipeline(parsed.data.source)
  if (!validated.ok) {
    return validated.error
  }

  const output: ExportChartOutput = {
    copyUrl: buildCopyUrl(parsed.data.source, editorBase),
    embedUrl: buildEmbedUrl(parsed.data.source, editorBase),
    frame: extractFrameMetadata(validated.ast),
  }

  // Scene-0 frame when the chart has scenes; base state otherwise (an explicit
  // index on a sceneless chart fails diagnose with E_UNKNOWN_SCENE_INDEX).
  const previewScene = (validated.ast.scenes?.length ?? 0) > 0 ? 0 : undefined

  const publicBase = getPublicBaseUrl()
  if (publicBase) {
    const urls = buildRenderUrls(parsed.data.source, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, scene: previewScene }, publicBase)
    if (urls) {
      output.urls = urls
    }
  }

  // Preview must never fail a valid export — degrade to URLs-only.
  // TODO: renderChart re-runs validatePipeline internally; a renderChartFromAst overload could skip the re-parse (~ms today, fine at preview scale).
  try {
    const preview = await renderChart(parsed.data.source, { format: 'png', scene: previewScene, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT })
    if (preview.ok) {
      output.png = (preview.body as Buffer).toString('base64')
      output.modelVisible = parsed.data.modelVisible
    }
    else {
      output.previewOmitted = true
    }
  }
  catch {
    output.previewOmitted = true
  }

  return toolOk(output)
}

/** PNG preview becomes the leading image block; base64 never enters the text. */
export function exportChartContent(result: ToolResult<ExportChartOutput>): FormattedToolResult {
  if (!result.ok || result.data.png === undefined) {
    return formatToolResult(result)
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
  }
}
