import { z } from 'zod'
import { parseDsl } from '../parse'
import { validateAst, type ValidationIssue } from '../dsl/validate'
import { collectWarnings, type WarningIssue } from '../dsl/semanticWarnings'
import { toolOk, type ToolResult } from '../errors'

export const ValidateInputSchema = z.object({
  source: z.string(),
})
export type ValidateInput = z.infer<typeof ValidateInputSchema>

export interface ValidateOutput {
  valid: boolean
  errors: ValidationIssue[]
  /** Non-fatal advisories (W_NO_EFFECT / W_NOT_IMPLEMENTED / W_MULTISERIES_SHAPE). `code` is a plain string until the warning catalogue stabilises; errors keep the strict ValidationCode union. */
  warnings: WarningIssue[]
}

export function validateDsl(input: ValidateInput): ToolResult<ValidateOutput> {
  const parsed = parseDsl(input.source)
  if (!parsed.ok) {
    return parsed
  }
  const errors = validateAst(parsed.data.ast)
  // Warnings are non-fatal: they never change `valid`. Only emit them when the
  // structure is sound, so authors fix hard errors before chasing advisories.
  const warnings = errors.length === 0 ? collectWarnings(parsed.data.ast) : []
  return toolOk({
    valid: errors.length === 0,
    errors,
    warnings,
  })
}
