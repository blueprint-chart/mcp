# @blueprint-chart/mcp

Model Context Protocol server for authoring [Blueprint Chart](https://blueprintchart.com) `.bpc` files with LLMs.

The MCP exposes Blueprint Chart's dataviz handbook, DSL grammar reference, chart-type docs, and canonical samples as MCP resources, plus four deterministic tools: `validate_dsl`, `inspect_dsl`, `recommend_chart_type`, and `render`. Your LLM writes the `.bpc`; the MCP grounds it in real dataviz pedagogy and gives it a tight feedback loop.

## Install

```bash
npx @blueprint-chart/mcp           # stdio (for Claude Desktop, Claude Code, Cursor)
npx @blueprint-chart/mcp --http    # HTTP/SSE on 127.0.0.1:4321
```

## Use with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blueprint-chart": {
      "command": "npx",
      "args": ["-y", "@blueprint-chart/mcp"]
    }
  }
}
```

## Use with Claude Code

```bash
claude mcp add blueprint-chart -- npx -y @blueprint-chart/mcp
```

## Tools

| Tool | Purpose |
| --- | --- |
| `validate_dsl` | Parse `.bpc`; precise errors with line/column |
| `inspect_dsl` | Parse and summarize: chart type, scenes, series, annotations |
| `recommend_chart_type` | Rank chart types for a given column shape |
| `render` | Render to SVG (default) or PNG |

## Resources

- `bpc://grammar` — full DSL syntax reference
- `bpc://handbook/<slug>` — dataviz pedagogy (choosing, design-principles, color, typography, annotations, accessibility, ...)
- `bpc://guide/<slug>` — usage guides (scenes, palettes, data-transforms, ...)
- `bpc://chart-types/<slug>` — per-chart-type docs
- `bpc://samples/<id>` — canonical `.bpc` examples
- `bpc://reference/dsl/<slug>`, `bpc://reference/api/<slug>` — full reference

## Prompts

- `author_chart` — primes the LLM end-to-end (read → write → validate → render → iterate)

## License

MIT
