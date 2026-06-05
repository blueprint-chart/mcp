<p align="center">
  <a href="https://blueprintchart.com" align="center">
    <img src="https://raw.githubusercontent.com/blueprint-chart/blueprint-chart/main/packages/editor/src/assets/images/blueprint-chart-logo.svg" width="120" alt="blueprint-chart">
  </a>
</p>
<p align="center"><strong>Model Context Protocol server for authoring Blueprint Chart <code>.bpc</code> files with LLMs, grounded in real dataviz pedagogy with a tight parse + render feedback loop. An open, plain-text chart format an AI can write and any browser can render. Self-contained, no backend, no account required.</strong></p>

<div align="center">

|      | Status |
| ---: | :--- |
| **CI checks** | [![Github Actions](https://img.shields.io/github/actions/workflow/status/blueprint-chart/mcp/ci.yml?style=flat-square)](https://github.com/blueprint-chart/mcp/actions/workflows/ci.yml) |
| **Latest version** | [![Latest version](https://img.shields.io/npm/v/@blueprint-chart/mcp?style=flat-square&color=success)](https://www.npmjs.com/package/@blueprint-chart/mcp) |
|   **Release date** | [![Release date](https://img.shields.io/github/release-date/blueprint-chart/mcp?style=flat-square&color=success)](https://github.com/blueprint-chart/mcp/releases/latest) |
|    **Open issues** | [![Open issues](https://img.shields.io/github/issues/blueprint-chart/mcp?style=flat-square&color=success)](https://github.com/blueprint-chart/mcp/issues/) |
|  **Websites** | [![Editor](https://img.shields.io/badge/Editor-2563A0?style=flat-square)](https://blueprintchart.com) [![Docs](https://img.shields.io/badge/Docs-2563A0?style=flat-square)](https://docs.blueprintchart.com) |

</div>

The MCP exposes Blueprint Chart's dataviz handbook, DSL grammar reference, chart-type docs, and canonical samples as MCP resources, plus eleven deterministic tools: `validate_dsl`, `inspect_dsl`, `recommend_chart_type`, `render`, `list_chart_types`, `describe_chart_type`, `get_example`, `get_grammar`, `export_chart`, `search_examples`, and `list_palettes`. Your LLM writes the `.bpc`; the MCP grounds it in real dataviz pedagogy and gives it a tight feedback loop.

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
claude mcp add blueprint-chart \
  -e BLUEPRINT_CHART_EDITOR_URL=https://blueprintchart.com \
  -e BLUEPRINT_CHART_DOCS_URL=https://docs.blueprintchart.com \
  -- npx -y @blueprint-chart/mcp
```

## Tools

| Tool | Purpose |
| --- | --- |
| `validate_dsl` | Parse `.bpc`; returns `{ valid, errors[], warnings[] }` — each error has `code`, `message`, `suggestion` |
| `inspect_dsl` | Parse and summarize: `chartType`, `scenes`, `seriesCount`, `rowCount`, `hasHighlights`, `hasColorizes`, etc. |
| `recommend_chart_type` | Rank chart types for a given column shape and row count |
| `render` | Render to SVG (default), PNG, or HTML; with `format:"png"` returns an inline image both you and the user can see. Always returns structured frame metadata. When `MCP_PUBLIC_URL` is set, includes `urls` (`{png,svg,bpc}`) — stateless links where the chart data travels inside the URL. Set `modelVisible:false` to show the image to the user without spending model image tokens. Pass `save:<path>` to write the output to disk (requires `MCP_FS_WRITE_DIR`; writes are confined to that directory). Width/height capped at 1600; PNG is 2× retina. |
| `list_chart_types` | List all renderable chart types (tool equivalent of `bpc://handbook/choosing`) |
| `describe_chart_type` | Properties, when-to-use, when-NOT-to-use, and data-shape for one chart type (tool equivalent of `bpc://chart-types/{slug}`) |
| `get_example` | Fetch a canonical `.bpc` sample by chart type or sample name (tool equivalent of `bpc://samples/{id}`) |
| `search_examples` | Find canonical examples by topic keywords and/or chart type (returns pointers; fetch full DSL with `get_example`) |
| `get_grammar` | Full DSL syntax reference (tool equivalent of `bpc://grammar`) |
| `list_palettes` | List named colour palettes with hex colours for `colorPalette` |
| `export_chart` | Validate a `.bpc` and return shareable URLs plus an inline scene-0 preview. Returns `{ copyUrl, embedUrl, urls?, frame }` — `copyUrl` is editable in the editor, `embedUrl` is a read-only iframe target, `urls.{png,svg,bpc}` are stateless rendered/source links (when `MCP_PUBLIC_URL` is set). Set `modelVisible:false` to show the preview to the user only. Requires `BLUEPRINT_CHART_EDITOR_URL`; preview failures never block the export. |

The discovery tools (`list_chart_types`, `describe_chart_type`, `get_example`, `search_examples`, `get_grammar`, `list_palettes`) let clients without MCP resource support access the same reference material that the `bpc://` URIs expose.

### Saving rendered output

The `render` tool can write its output to disk via `save: <path>`. This is disabled by default. Set `MCP_FS_WRITE_DIR` to a directory to enable it — ideally an absolute path; a relative value is resolved from the server's working directory at startup. Every write lands inside that directory (a sandbox), so you never have to worry about where a client puts files: relative `save` paths are joined to it, an absolute path already inside it is used as-is, and any other absolute path is re-anchored under it (the leading slash is stripped and the rest joined on, so `save: "/tmp/foo.png"` becomes `<dir>/tmp/foo.png`). Only paths that still escape via `../` traversal are rejected. Missing subdirectories are created automatically. Containment is checked lexically (no `realpath`), so a symlink whose lexical path is inside the sandbox still passes the check and is then resolved by the OS at write time — if its target is outside the sandbox, the write reaches it. Avoid placing symlinks in the sandbox if isolation matters to you.

Add the `-e` flag to your `claude mcp add` command:

```bash
claude mcp add blueprint-chart \
  -e MCP_FS_WRITE_DIR=/path/to/output \
  -- npx -y @blueprint-chart/mcp
```

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
> **Claude:** *(calls `list_chart_types`, `get_example({ chartType: "bar-horizontal" })`, writes the `.bpc`, calls `validate_dsl` to confirm it parses, calls `render` with `format: 'png'` and shows you the image and the source)*
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

### `validate_dsl` — parse with structured diagnostics

Request:

```json
{
  "name": "validate_dsl",
  "arguments": { "source": "chart bar-vertical {\n  title = \"oops\n}" }
}
```

Response — `valid` is false; each entry in `errors[]` carries a `code`, human-readable `message`, and an actionable `suggestion`:

```json
{
  "valid": false,
  "errors": [
    {
      "code": "E_PARSE",
      "message": "Expected \"\\\"\" but end of input found.",
      "suggestion": "Close the string literal on line 2."
    }
  ],
  "warnings": []
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

### `render` — SVG (default), PNG, or HTML

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
    "mimeType": "image/png",
    "urls": {
      "png": "https://mcp.blueprintchart.com/render.png?bpc64=…",
      "svg": "https://mcp.blueprintchart.com/render.svg?bpc64=…",
      "bpc": "https://mcp.blueprintchart.com/render.bpc?bpc64=…"
    }
  }
}
```

The `urls` field is only present when `MCP_PUBLIC_URL` is configured; every `render` and `export_chart` response then includes these stateless links, with the chart data travelling inside the URL (as `bpc64`, a URL-safe base64 encoding of the `.bpc` source) — no session, no server state required. Set `modelVisible:false` in the request to display the inline image to the user without spending model image tokens.

If rasterization fails (rare), `errors[]` is non-empty — each entry has a `code` (`"E_RENDER"`) and a `suggestion` — **and the response still includes** the SVG that was successfully produced, so partial success is preserved.

#### Hosted render URLs

Embed a chart directly in a page:

```html
<img src="https://<your-mcp-host>/render.png?bpc64=<bpc64value>&width=800&height=500" alt="My chart" width="800" height="500">
```

`/render.bpc` serves the raw `.bpc` source — it's "view source" for any chart URL, handy for sharing or reproducing a chart from its link alone.

Sources whose encoding exceeds 8 KB return `413` from the endpoints (and the tool omits `urls`, returning `urlsOmitted: "source-too-large"` instead) — use the inline PNG for very large charts.

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
