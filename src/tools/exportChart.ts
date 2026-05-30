import { z } from 'zod'
import { getEditorBaseUrl } from '../links/editorConfig'
import { buildCopyUrl, buildEmbedUrl } from '../links/buildUrls'
import { validatePipeline } from '../render/validatePipeline'
import { extractFrameMetadata, type FrameMetadata } from '../render/frame'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

export const ExportChartInputSchema = z.object({
  source: z.string(),
}).strict()
export type ExportChartInput = z.infer<typeof ExportChartInputSchema>

export interface ExportChartOutput {
  copyUrl: string
  embedUrl: string
  frame: FrameMetadata
}

export function exportChart(input: unknown): ToolResult<ExportChartOutput> {
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

  return toolOk({
    copyUrl: buildCopyUrl(parsed.data.source, editorBase),
    embedUrl: buildEmbedUrl(parsed.data.source, editorBase),
    frame: extractFrameMetadata(validated.ast),
  })
}
