import type { ZodTypeAny } from 'zod'
import { zodToJsonSchema as toJsonSchema } from 'zod-to-json-schema'

/**
 * Convert a Zod schema to a JSON Schema object suitable for MCP `tools/list`.
 *
 * MCP clients (notably claude.ai web) introspect this schema to know what
 * parameters a tool accepts. A permissive stub left tools effectively
 * un-invokable because the param shapes weren't discoverable.
 *
 * `zod-to-json-schema` produces a `$schema`-prefixed draft-07 document; we
 * unwrap that to just the inline schema body so it slots cleanly into the
 * MCP tool descriptor.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const full = toJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' })
  const { $schema: _$schema, ...rest } = full as Record<string, unknown>
  return rest
}
