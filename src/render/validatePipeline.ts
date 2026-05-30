import type { ChartNode } from '@blueprint-chart/lib'
import { parseDsl } from '../parse'
import { validateAst } from '../dsl/validate'
import { diagnoseRender } from './diagnose'
import { ErrorCode, toolError, type ToolErrorEntry, type ToolResult } from '../errors'

export type ValidatePipelineResult =
  | { ok: true, ast: ChartNode }
  | { ok: false, error: Extract<ToolResult<never>, { ok: false }> }

export interface ValidatePipelineOptions {
  sceneIndex?: number
}

/**
 * Run the three-layer validation a renderable chart must pass:
 *   1. parse (E_PARSE)
 *   2. semantic validation — unknown types/props, empty data (E_SEMANTIC)
 *   3. render diagnostic — colorize/highlight resolution, scene index (E_RENDER)
 * On success returns the parsed AST. On failure returns the structured error
 * exactly as `render` would, so callers share one set of error semantics.
 */
export function validatePipeline(
  source: string,
  opts: ValidatePipelineOptions = {},
): ValidatePipelineResult {
  const parseResult = parseDsl(source)
  if (!parseResult.ok) {
    return { ok: false, error: parseResult }
  }

  const issues = validateAst(parseResult.data.ast)
  if (issues.length > 0) {
    const entries: ToolErrorEntry[] = issues.map(i => ({
      code: i.code,
      path: i.path,
      message: i.message,
      suggestion: i.suggestion,
      context: i.context,
    }))
    return { ok: false, error: toolError(ErrorCode.E_SEMANTIC, entries) }
  }

  const diag = diagnoseRender(source, { sceneIndex: opts.sceneIndex })
  if (!diag.ok) {
    const entries: ToolErrorEntry[] = diag.diagnostics.map(d => ({
      code: d.code,
      path: d.path,
      message: d.message,
      suggestion: d.suggestion,
      context: d.context,
    }))
    return { ok: false, error: toolError(ErrorCode.E_RENDER, entries) }
  }

  return { ok: true, ast: parseResult.data.ast }
}
