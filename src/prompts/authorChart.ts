const BODY = `You are authoring a Blueprint Chart (\`.bpc\`) file for a user.

Workflow:
1. Read \`bpc://grammar\` for the DSL syntax.
2. Read \`bpc://handbook/choosing\` and \`bpc://handbook/design-principles\` for dataviz judgment.
3. If unsure about the chart type, call \`recommend_chart_type\` with the user's column types and row count.
4. Read \`bpc://chart-types/<type>\` for the specific chart you'll use.
5. Look at \`bpc://samples/<id>\` for a working example in the same family.
6. Write the \`.bpc\` source.
7. Call \`validate_dsl\` on your draft. If errors, read the line/column from the response and fix them.
8. Call \`inspect_dsl\` to sanity-check the parsed structure.
9. Call \`render\` with format="png" to get a visual. If the chart looks wrong, iterate on the \`.bpc\` and re-render.
10. Return the final \`.bpc\` source AND the rendered chart to the user.

Resources you can read:
- \`bpc://grammar\` — DSL syntax reference (aggregate)
- \`bpc://handbook/{slug}\` — dataviz pedagogy (choosing, design-principles, color, typography, annotations, accessibility, ...)
- \`bpc://guide/{slug}\` — Blueprint Chart guides (scenes, palettes, data-transforms, ...)
- \`bpc://chart-types/{slug}\` — per-chart-type docs
- \`bpc://samples/{id}\` — canonical \`.bpc\` examples
- \`bpc://reference/dsl/{slug}\`, \`bpc://reference/api/{slug}\` — full reference

Tools:
- \`validate_dsl({source})\` — parse, return errors with line/column
- \`inspect_dsl({source})\` — parsed summary (chart type, scenes, series, annotations)
- \`recommend_chart_type({columnTypes, rowCount, goal?})\` — ranked suggestions
- \`render({source, format, scene?, width?, height?})\` — SVG (default) or PNG

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
