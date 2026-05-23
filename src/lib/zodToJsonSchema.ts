// Minimal zod → JSON Schema for v3 zod. Replace with `zod-to-json-schema` package if surface grows.
import type { ZodTypeAny } from 'zod'

/**
 * Permissive stub: returns a generic object schema that allows any properties.
 * MCP tool handlers do the precise runtime validation via Zod. If MCP clients
 * begin requiring precise JSON Schema for `listTools`, replace this body with
 * the `zod-to-json-schema` package.
 */
export function zodToJsonSchema(_schema: ZodTypeAny): Record<string, unknown> {
  return { type: 'object', additionalProperties: true }
}
