import type { Annotations } from '@modelcontextprotocol/sdk/types.js'
import type { ToolResult } from './errors'

export interface TextContent {
  type: 'text'
  text: string
  annotations?: Annotations
}

export interface ImageContent {
  type: 'image'
  data: string
  mimeType: string
  annotations?: Annotations
}

export interface FormattedToolResult {
  content: Array<TextContent | ImageContent>
  structuredContent?: unknown
  isError?: boolean
  [k: string]: unknown
}

export function formatToolResult<T>(result: ToolResult<T>): FormattedToolResult {
  if (result.ok) {
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      structuredContent: result.data,
    }
  }
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ code: result.code, errors: result.errors }, null, 2) }],
  }
}

/**
 * Format a result whose payload carries a base64 PNG. The base64 never enters
 * the text or structured content, and `modelVisible: false` drops the image
 * block outright: `annotations.audience` is only a hint, so a client that
 * ignores it still spends the image tokens the flag exists to save.
 */
export function formatWithPngPreview<T extends { png?: string, modelVisible?: boolean }>(
  result: ToolResult<T>,
): FormattedToolResult {
  if (!result.ok) {
    return formatToolResult(result)
  }
  const { png, modelVisible, ...payload } = result.data
  const text: TextContent = { type: 'text', text: JSON.stringify(payload, null, 2) }
  const content = png !== undefined && modelVisible !== false
    ? [{ type: 'image' as const, data: png, mimeType: 'image/png' }, text]
    : [text]
  return { content, structuredContent: payload }
}
