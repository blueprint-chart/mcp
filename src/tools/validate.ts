import { z } from 'zod'
import { parseDsl } from '../parse'
import { toolOk, type ToolResult } from '../errors'

export const ValidateInputSchema = z.object({
  source: z.string(),
})
export type ValidateInput = z.infer<typeof ValidateInputSchema>

export function validateDsl(input: ValidateInput): ToolResult<{ valid: true }> {
  const parsed = parseDsl(input.source)
  if (!parsed.ok) {
    return parsed
  }
  return toolOk({ valid: true as const })
}
