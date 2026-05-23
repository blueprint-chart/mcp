import { parse as libParse } from '@blueprint-chart/lib'
import type { ChartNode } from '@blueprint-chart/lib'
import { ErrorCode, toolError, toolOk, type ToolResult } from './errors'

export function parseDsl(source: unknown): ToolResult<{ ast: ChartNode }> {
  if (typeof source !== 'string') {
    return toolError(ErrorCode.E_INPUT, [{ path: 'source', message: 'expected string' }])
  }
  try {
    const ast = libParse(source)
    return toolOk({ ast })
  }
  catch (err: unknown) {
    if (err instanceof Error) {
      // lib's parser wraps SyntaxError with " at L:C" suffix in the message
      const match = err.message.match(/^(.*) at (\d+):(\d+)$/)
      if (match) {
        const [, message, line, column] = match
        return toolError(ErrorCode.E_PARSE, [
          { line: Number(line), column: Number(column), message: message!.trim() },
        ])
      }
      return toolError(ErrorCode.E_PARSE, [{ message: err.message }])
    }
    return toolError(ErrorCode.E_INTERNAL, [{ message: String(err) }])
  }
}
