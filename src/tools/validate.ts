import { z } from 'zod'
import { validateChart, type ValidationIssue as LibValidationIssue } from '@blueprint-chart/lib'
import { parseDsl } from '../parse'
import { validateAst, type ValidationIssue } from '../dsl/validate'
import { collectWarnings, type WarningIssue } from '../dsl/semanticWarnings'
import { toolOk, type ToolResult } from '../errors'

// lib validateChart codes whose intent is already covered by the MCP's own
// structural checks (validateAst). We drop these to avoid double-reporting and
// keep the MCP's richer messages/suggestions as the canonical voice.
const LIB_CODES_COVERED_BY_MCP = new Set<string>([
  'unknown-chart-type', // ↔ E_UNKNOWN_CHART_TYPE
  'unknown-property', //   ↔ E_UNKNOWN_PROPERTY
  'missing-data', //       ↔ E_EMPTY_DATA
])

// lib 0.1.30's published samples (bitcoin-price, unemployment-rates) still ship
// a `dy` annotation key, and this server serves them as canonical examples via
// get_example. The flag is a TRUE positive (`dy` is dropped by convertAnnotations;
// the modern key is `textOffsetY`), but surfacing it would teach that our own
// examples are broken. Samples are fixed upstream on lib main; REMOVE this
// suppression when bumping past 0.1.30. Everything else under
// `unknown-annotation-property` (e.g. a range's `fromX`) still surfaces.
function isKnownHonoredAnnotationProp(issue: LibValidationIssue): boolean {
  return issue.code === 'unknown-annotation-property' && issue.path.endsWith('.dy')
}

function keepLibIssue(issue: LibValidationIssue): boolean {
  return !LIB_CODES_COVERED_BY_MCP.has(issue.code) && !isKnownHonoredAnnotationProp(issue)
}

// Map a lib ValidationIssue (code/path/message/suggestion) into the MCP's
// WarningIssue shape — the two are structurally aligned, lib's code is a plain
// string which our widened warning code accepts.
function fromLibIssue(issue: LibValidationIssue): WarningIssue {
  return {
    code: issue.code,
    path: issue.path,
    message: issue.message,
    ...(issue.suggestion !== undefined && { suggestion: issue.suggestion }),
  }
}

export const ValidateInputSchema = z.object({
  source: z.string(),
})
export type ValidateInput = z.infer<typeof ValidateInputSchema>

export interface ValidateOutput {
  valid: boolean
  /** MCP structural errors (strict ValidationCode union) plus appended lib value-level errors (e.g. `invalid-boolean`, whose `code` is a plain string). */
  errors: WarningIssue[]
  /** Non-fatal advisories (W_NO_EFFECT / W_NOT_IMPLEMENTED / W_MULTISERIES_SHAPE) plus lib series meta-row warnings. `code` is a plain string; the strict union widens to string here. */
  warnings: WarningIssue[]
}

export function validateDsl(input: ValidateInput): ToolResult<ValidateOutput> {
  const parsed = parseDsl(input.source)
  if (!parsed.ok) {
    return parsed
  }
  const mcpErrors: ValidationIssue[] = validateAst(parsed.data.ast)

  // Append lib's value-level checks (invalid-boolean/-choice, unknown-transform,
  // annotation body keys) whose intent the MCP's structural checks don't cover.
  const lib = validateChart(parsed.data.ast)
  const libErrors = lib.errors.filter(keepLibIssue).map(fromLibIssue)
  const errors: WarningIssue[] = [...mcpErrors, ...libErrors]

  // Warnings are non-fatal: they never change `valid`. Only emit them when the
  // structure is sound, so authors fix hard errors before chasing advisories.
  const warnings = errors.length === 0
    ? [
        ...collectWarnings(parsed.data.ast),
        ...lib.warnings.filter(keepLibIssue).map(fromLibIssue),
      ]
    : []

  return toolOk({
    valid: errors.length === 0,
    errors,
    warnings,
  })
}
