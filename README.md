<p align="center">
  <a href="https://blueprintchart.com" align="center">
    <img src="https://raw.githubusercontent.com/blueprint-chart/blueprint-chart/main/packages/editor/src/assets/images/blueprint-chart-logo.svg" width="120" alt="blueprint-chart">
  </a>
</p>
<p align="center"><strong>Model Context Protocol server for authoring Blueprint Chart <code>.bpc</code> files with LLMs — grounded in real dataviz pedagogy with a tight parse + render feedback loop.</strong></p>

<div align="center">

|      | Status |
| ---: | :--- |
| **CI checks** | [![Github Actions](https://img.shields.io/github/actions/workflow/status/blueprint-chart/mcp/ci.yml?style=flat-square)](https://github.com/blueprint-chart/mcp/actions/workflows/ci.yml) |
| **Latest version** | [![Latest version](https://img.shields.io/npm/v/@blueprint-chart/mcp?style=flat-square&color=success)](https://www.npmjs.com/package/@blueprint-chart/mcp) |
|   **Release date** | [![Release date](https://img.shields.io/github/release-date/blueprint-chart/mcp?style=flat-square&color=success)](https://github.com/blueprint-chart/mcp/releases/latest) |
|    **Open issues** | [![Open issues](https://img.shields.io/github/issues/blueprint-chart/mcp?style=flat-square&color=success)](https://github.com/blueprint-chart/mcp/issues/) |
|  **Websites** | [![Editor](https://img.shields.io/badge/Editor-2563A0?style=flat-square)](https://blueprintchart.com) [![Docs](https://img.shields.io/badge/Docs-2563A0?style=flat-square)](https://docs.blueprintchart.com) |

</div>

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

## Examples

### Quickstart with Claude

Once the MCP is connected, ask Claude to make a chart:

> **You:** Make a horizontal bar chart of English letter frequencies — top 10, highlight E.
>
> **Claude:** *(reads `bpc://grammar`, `bpc://handbook/choosing`, `bpc://samples/letter-frequency`, writes the `.bpc`, calls `validate_dsl` to confirm it parses, calls `render` with `format: 'png'` and shows you the image and the source)*
>
> Here's the chart:
>
> ![image]
>
> ```
> chart bar-horizontal {
>   title = "E is the most frequent letter in English"
>   sort = descending
>   valueLabels = true
>   highlight "E"
>   data { "E" = 12.70; "T" = 9.06; "A" = 8.17; ... }
> }
> ```

The MCP grounds Claude in real dataviz pedagogy (the handbook) before it writes a single line of DSL, then closes the loop with deterministic parse + render feedback.

### What `.bpc` looks like

```text
chart bar-vertical {
  title = "E is the most frequent letter in English"
  description = "How often each letter appears in typical English text"
  source = "Lewand, Cryptological Mathematics"
  colorPalette = "London"
  sort = descending
  valueLabels = true
  highlight "E"

  data {
    "E" = 12.70
    "T" = 9.06
    "A" = 8.17
    "O" = 7.51
    ...
  }
}
```

Full grammar at `bpc://grammar`; 17 canonical samples at `bpc://samples/<id>` (`letter-frequency`, `co2-emissions`, `quarterly-revenue`, `browser-market`, `temperature-anomaly`, `population-stacked-bar`, ...).

### `validate_dsl` — parse with precise errors

Request:

```json
{
  "name": "validate_dsl",
  "arguments": { "source": "chart bar-vertical {\n  title = \"oops\n}" }
}
```

Response (note the line + column):

```json
{
  "ok": false,
  "code": "E_PARSE",
  "errors": [
    { "line": 2, "column": 19, "message": "Expected \"\\\"\" but end of input found." }
  ]
}
```

### `inspect_dsl` — structured summary

Request:

```json
{ "name": "inspect_dsl", "arguments": { "source": "<.bpc source>" } }
```

Response:

```json
{
  "ok": true,
  "data": {
    "chartType": "bar-vertical",
    "scenes": [{ "index": 0, "hasTransition": false }],
    "hasAnnotations": false,
    "hasColorizes": false,
    "hasHighlights": true,
    "hasAreaFills": false,
    "seriesCount": 0,
    "rowCount": 26
  }
}
```

### `recommend_chart_type` — ranked suggestions

Request:

```json
{
  "name": "recommend_chart_type",
  "arguments": { "columnTypes": ["date", "number", "number", "number"], "rowCount": 24 }
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "recommendations": [
      { "chartType": "line-multi", "label": "Multi-Line Chart", "fitness": "best",
        "reason": "1 date + 3 numeric columns — compare trends" },
      { "chartType": "bar-multi",  "label": "Grouped Bar Chart", "fitness": "alternative",
        "reason": "Can also show as grouped bars" }
    ]
  }
}
```

### `render` — SVG (default) or PNG

Request:

```json
{
  "name": "render",
  "arguments": { "source": "<.bpc source>", "format": "png", "width": 800, "height": 500 }
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "svg": "<svg ...>...</svg>",
    "png": "<base64-encoded image>",
    "mimeType": "image/png"
  }
}
```

If rasterization fails (rare), the response is `{ ok: false, code: "E_RENDER", … }` **and still includes** the SVG that was successfully produced — partial success is preserved.

### Reading a resource

```json
{ "uri": "bpc://handbook/choosing" }
```

Returns the full Markdown of the "Choosing the Right Chart" handbook page (same content as `docs.blueprintchart.com`).

```json
{ "uri": "bpc://samples/letter-frequency" }
```

Returns the raw `.bpc` source for the letter-frequency sample as `text/plain` — exactly what the LLM should imitate.

## License

MIT
