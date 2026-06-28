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
