import { z } from 'zod'
import { parseDsl } from '../parse'
import { validateAst, type ValidationIssue } from '../dsl/validate'
import { toolOk, type ToolResult } from '../errors'

export const ValidateInputSchema = z.object({
  source: z.string(),
})
export type ValidateInput = z.infer<typeof ValidateInputSchema>

export interface ValidateOutput {
  valid: boolean
  errors: ValidationIssue[]
  /**
   * Reserved for non-fatal advisories. Currently always empty; future versions
   * may populate this without breaking existing clients.
   */
  warnings: ValidationIssue[]
}

export function validateDsl(input: ValidateInput): ToolResult<ValidateOutput> {
  const parsed = parseDsl(input.source)
  if (!parsed.ok) {
    return parsed
  }
  const issues = validateAst(parsed.data.ast)
  return toolOk({
    valid: issues.length === 0,
    errors: issues,
    // `warnings` is reserved for non-fatal advisories. Currently always empty;
    // future versions may populate this without breaking existing clients.
    warnings: [],
  })
}
