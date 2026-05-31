import { parse as libParse } from '@blueprint-chart/lib'
import type { ChartNode } from '@blueprint-chart/lib'
import { ErrorCode, toolError, toolOk, type ToolResult } from './errors'
import { humanizeParseError } from './dsl/parseErrorHints'

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
      const match = err.message.match(/^(.*) at (\d+):(\d+)$/)
      if (match) {
        const [, rawMessage, line, column] = match
        const h = humanizeParseError(rawMessage!.trim())
        return toolError(ErrorCode.E_PARSE, [{
          line: Number(line),
          column: Number(column),
          message: h.message,
          ...(h.suggestion !== undefined && { suggestion: h.suggestion }),
        }])
      }
      const h = humanizeParseError(err.message)
      return toolError(ErrorCode.E_PARSE, [{
        message: h.message,
        ...(h.suggestion !== undefined && { suggestion: h.suggestion }),
      }])
    }
    return toolError(ErrorCode.E_INTERNAL, [{ message: String(err) }])
  }
}
