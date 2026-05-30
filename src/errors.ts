export const ErrorCode = {
  E_INPUT: 'E_INPUT',
  E_PARSE: 'E_PARSE',
  E_SEMANTIC: 'E_SEMANTIC',
  E_RENDER: 'E_RENDER',
  E_CONFIG: 'E_CONFIG',
  E_INTERNAL: 'E_INTERNAL',
} as const
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ToolErrorEntry {
  /**
   * Item-level error code in `E_XXX` shape.
   *
   * Intentionally typed as `string` rather than the `ErrorCode` enum.
   * Item-level codes are driven by the context that produced the error:
   * - validation errors use `ValidationCode` values (e.g. `'E_UNKNOWN_PROPERTY'`)
   * - render pre-flight uses `RenderDiagnosticCode` values (e.g. `'E_NO_DATA'`)
   * - individual tools may define their own codes (e.g. `'E_UNKNOWN_SAMPLE'`)
   *
   * These codes differ from the top-level `ToolResult.code` field, which always
   * uses the `ErrorCode` enum and categorises the failure class (parse, input,
   * render, etc.). Item-level codes do not need to be enumerated here.
   */
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

export function toolError<T = never>(code: ErrorCode, errors: ToolErrorEntry[]): Extract<ToolResult<T>, { ok: false }> {
  return { ok: false, code, errors }
}

export function isToolError<T>(r: ToolResult<T>): r is Extract<ToolResult<T>, { ok: false }> {
  return r.ok === false
}
