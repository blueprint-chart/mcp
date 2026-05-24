export const ErrorCode = {
  E_INPUT: 'E_INPUT',
  E_PARSE: 'E_PARSE',
  E_SEMANTIC: 'E_SEMANTIC',
  E_RENDER: 'E_RENDER',
  E_INTERNAL: 'E_INTERNAL',
} as const
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ToolErrorEntry {
  code?: string
  path?: string
  line?: number
  column?: number
  message: string
  snippet?: string
  context?: Record<string, unknown>
  suggestion?: string
}

export type ToolResult<T> =
  | { ok: true, data: T }
  | { ok: false, code: ErrorCode, errors: ToolErrorEntry[] }

export function toolOk<T>(data: T): ToolResult<T> {
  return { ok: true, data }
}

export function toolError<T = never>(code: ErrorCode, errors: ToolErrorEntry[]): ToolResult<T> {
  return { ok: false, code, errors }
}

export function isToolError<T>(r: ToolResult<T>): r is Extract<ToolResult<T>, { ok: false }> {
  return r.ok === false
}
