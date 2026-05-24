const BODY = `You are authoring a Blueprint Chart (\`.bpc\`) file for a user.

Workflow:
1. Call \`list_chart_types\` to see what's renderable. (Or read \`bpc://handbook/choosing\` if your client supports resources.)
2. If unsure which type to use, call \`recommend_chart_type({ columnTypes, rowCount, goal? })\`.
3. Call \`describe_chart_type({ name: "<type>" })\` for properties, when-to-use, and a data-shape example.
4. Call \`get_example({ chartType: "<type>" })\` (or \`{ name: "<sample-id>" }\`) to copy a canonical .bpc as a starting point.
5. Write the \`.bpc\` source.
6. Call \`validate_dsl\` — read \`errors[]\`: each entry has \`code\`, \`message\`, \`suggestion\`. Fix and retry.
7. Call \`inspect_dsl\` to sanity-check structure: \`data.rowCount\` confirms rows parsed, \`hasHighlights\`/\`hasColorizes\` confirm overrides.
8. Call \`render({ source, format: "png" })\` for a visual. If \`errors[]\` is non-empty, each entry has \`code\` and a usable \`suggestion\`.
9. Return the final \`.bpc\` and rendered chart to the user.

Resources you can read (if your client supports MCP resources):
- \`bpc://grammar\` — DSL syntax reference (use \`get_grammar\` as a tool equivalent)
- \`bpc://handbook/{slug}\` — dataviz pedagogy (choosing, design-principles, color, typography, annotations, accessibility, ...)
- \`bpc://guide/{slug}\` — Blueprint Chart guides (scenes, palettes, data-transforms, ...)
- \`bpc://chart-types/{slug}\` — per-chart-type docs (use \`describe_chart_type\` as a tool equivalent)
- \`bpc://samples/{id}\` — canonical \`.bpc\` examples (use \`get_example\` as a tool equivalent)
- \`bpc://reference/dsl/{slug}\`, \`bpc://reference/api/{slug}\` — full reference

Tools:
- \`validate_dsl({source})\` — parse; returns \`{ valid, errors[], warnings[] }\` — each error has \`code\`, \`message\`, \`suggestion\`
- \`inspect_dsl({source})\` — parsed summary: \`chartType\`, \`scenes\`, \`seriesCount\`, \`rowCount\`, \`hasHighlights\`, \`hasColorizes\`, etc.
- \`recommend_chart_type({columnTypes, rowCount, goal?})\` — ranked chart-type suggestions
- \`render({source, format, scene?, width?, height?})\` — SVG (default) or PNG; \`errors[]\` on failure (each has \`code\` + \`suggestion\`)
- \`list_chart_types()\` — list all renderable chart types (tool equivalent of \`bpc://handbook/choosing\`)
- \`describe_chart_type({name})\` — properties, when-to-use, data-shape for one chart type (tool equivalent of \`bpc://chart-types/{slug}\`)
- \`get_example({chartType?, name?})\` — fetch a canonical \`.bpc\` sample (tool equivalent of \`bpc://samples/{id}\`)
- \`get_grammar()\` — full DSL syntax reference (tool equivalent of \`bpc://grammar\`)

Be patient with errors — the feedback loop is the point.`

export interface AuthorChartPrompt {
  description: string
  messages: Array<{
    role: 'user'
    content: { type: 'text', text: string }
  }>
  [k: string]: unknown
}

export function authorChartPrompt(): AuthorChartPrompt {
  return {
    description: 'Author a Blueprint Chart .bpc file with the LLM as the writer; the MCP as validator + renderer.',
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: BODY } }],
  }
}
