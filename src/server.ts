import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateDsl, ValidateInputSchema, ValidateOutputSchema } from './tools/validate'
import { inspectDsl, InspectInputSchema, InspectOutputSchema } from './tools/inspect'
import { recommendChartType, RecommendInputSchema, RecommendOutputSchema } from './tools/recommend'
import { renderTool, RenderInputSchema, renderToolContent, RenderOutputSchema, type RenderOutput } from './tools/render'
import { listChartTypes, ListChartTypesInputSchema, ListChartTypesOutputSchema } from './tools/listChartTypes'
import { describeChartType, DescribeChartTypeInputSchema, DescribeChartTypeOutputSchema } from './tools/describeChartType'
import { getExample, GetExampleInputSchema, GetExampleOutputSchema } from './tools/getExample'
import { getGrammar, GetGrammarInputSchema, GetGrammarOutputSchema } from './tools/getGrammar'
import { exportChart, ExportChartInputSchema, exportChartContent, ExportChartOutputSchema, type ExportChartOutput } from './tools/exportChart'
import { searchExamples, SearchExamplesInputSchema, SearchExamplesOutputSchema } from './tools/searchExamples'
import { listPalettesTool, ListPalettesInputSchema, ListPalettesOutputSchema } from './tools/listPalettes'
import { listResources, readResource } from './resources/index'
import { authorChartPrompt } from './prompts/authorChart'
import { zodToJsonSchema } from './lib/zodToJsonSchema'
import type { ToolResult } from './errors'
import { formatToolResult, type FormattedToolResult } from './toolContent'
import { getPublicBaseUrl } from './links/editorConfig'

interface ToolDef {
  description: string
  inputSchema: Parameters<typeof zodToJsonSchema>[0]
  outputSchema?: Parameters<typeof zodToJsonSchema>[0]
  handler: (args: unknown) => ToolResult<unknown> | Promise<ToolResult<unknown>>
  /** Optional content-block formatter. Defaults to formatToolResult (single text block). */
  format?: (result: ToolResult<unknown>) => FormattedToolResult
}

// Server metadata is embedded into every `initialize` response's `serverInfo`.
// Icons are advertised only when `MCP_PUBLIC_URL` is set (e.g. on a hosted
// deployment) — they must be absolute URLs because some MCP clients reject
// `data:` URIs. For stdio / local use the env var is typically unset and the
// `icons` field is omitted entirely.
const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
  version: string
  description?: string
  homepage?: string
}

interface ServerIcon {
  src: string
  mimeType: string
  sizes?: string[]
}

function buildServerIcons(): ServerIcon[] | undefined {
  const baseUrl = getPublicBaseUrl()
  if (!baseUrl) {
    return undefined
  }
  return [
    { src: `${baseUrl}/favicon.svg`, mimeType: 'image/svg+xml' },
    { src: `${baseUrl}/favicon.png`, mimeType: 'image/png', sizes: ['256x256'] },
  ]
}

export const TOOLS: Record<string, ToolDef> = {
  validate_dsl: {
    description: 'Parse and semantically validate a .bpc source. Returns { valid, errors[], warnings[] }. Errors include unknown chart types, unknown properties, and empty data blocks with nearest-neighbour suggestions.',
    inputSchema: ValidateInputSchema,
    outputSchema: ValidateOutputSchema,
    handler: args => validateDsl(args as { source: string }),
  },
  inspect_dsl: {
    description: 'Parse a .bpc source and return a structured summary: chartType, scenes, data (rowCount, entryCount, labels, seriesNames, multiSeries), annotation/colorize/highlight/area-fill presence flags, series count.',
    inputSchema: InspectInputSchema,
    outputSchema: InspectOutputSchema,
    handler: args => inspectDsl(args as { source: string }),
  },
  recommend_chart_type: {
    description: 'Start here before writing any .bpc. Takes column types, row count, and the user\'s goal (a prose sentence — it determines the chart family: comparison/ranking/part-to-whole/composition-over-time/trend/range). Returns ranked chart-type recommendations plus guidance.',
    inputSchema: RecommendInputSchema,
    outputSchema: RecommendOutputSchema,
    handler: args => recommendChartType(args),
  },
  render: {
    description: 'Render a .bpc source to SVG (default), PNG, or HTML. With format:"png" the chart comes back as an inline IMAGE you and the user can both see — render, look at the result, fix issues, re-render. Always returns structured frame metadata. When MCP_PUBLIC_URL is set the response includes stateless `urls` ({png,svg,bpc}). Set modelVisible:false to display the image to the user without spending model image tokens. Pass `save:<path>` to write the output into MCP_FS_WRITE_DIR instead of returning it inline. Width/height are capped at 1600; PNGs are rasterized at 2× for retina sharpness.',
    inputSchema: RenderInputSchema,
    outputSchema: RenderOutputSchema,
    handler: args => renderTool(args),
    format: result => renderToolContent(result as ToolResult<RenderOutput>),
  },
  list_chart_types: {
    description: 'Reference list of every chart type the renderer supports, with aliases and one-line summaries. To choose a type for a dataset, call recommend_chart_type instead.',
    inputSchema: ListChartTypesInputSchema,
    outputSchema: ListChartTypesOutputSchema,
    handler: () => listChartTypes(),
  },
  describe_chart_type: {
    description: 'Return everything an LLM needs to write a .bpc for a given chart type — typically your second call, after recommend_chart_type. Input: { chartType: "bar-horizontal" } (or any canonical/alias name). Returns summary, when-to-use, when-NOT-to-use, full property list with enum choices, data-shape example, and a pointer to a canonical sample.',
    inputSchema: DescribeChartTypeInputSchema,
    outputSchema: DescribeChartTypeOutputSchema,
    handler: args => describeChartType(args),
  },
  get_example: {
    description: 'Return a canonical .bpc example. Pass { name } for a specific sample id, { chartType } for the first sample of that type, or no args for a starter sample.',
    inputSchema: GetExampleInputSchema,
    outputSchema: GetExampleOutputSchema,
    handler: args => getExample(args),
  },
  search_examples: {
    description: 'Find canonical .bpc examples by topic keywords and/or chart type. Returns ranked pointers { id, title, description, chartType } — call get_example with an id to fetch the full DSL.',
    inputSchema: SearchExamplesInputSchema,
    outputSchema: SearchExamplesOutputSchema,
    handler: args => searchExamples(args),
  },
  list_palettes: {
    description: 'List every named colour palette with its label and hex colours, for use in `colorPalette = "<name>"`.',
    inputSchema: ListPalettesInputSchema,
    outputSchema: ListPalettesOutputSchema,
    handler: () => listPalettesTool(),
  },
  get_grammar: {
    description: 'Return the .bpc DSL grammar as markdown. Pass { section: "chart" | "data" | "properties" | "scenes" | "annotations" } for a focused subset, or no args for the full grammar.',
    inputSchema: GetGrammarInputSchema,
    outputSchema: GetGrammarOutputSchema,
    handler: args => getGrammar(args),
  },
  export_chart: {
    description: 'Turn a validated .bpc source into shareable URLs plus an inline visual preview of what was published. Returns { copyUrl, embedUrl, urls?, frame } and a scene-0 PNG image block so you can confirm the chart looks right before sharing. copyUrl opens an editable copy in the editor; embedUrl is a read-only iframe target; urls.{png,svg,bpc} (when MCP_PUBLIC_URL is set) are stateless rendered-image/source links. Set modelVisible:false to show the preview to the user only. Requires BLUEPRINT_CHART_EDITOR_URL; preview failures never block the export.',
    inputSchema: ExportChartInputSchema,
    outputSchema: ExportChartOutputSchema,
    handler: args => exportChart(args),
    format: result => exportChartContent(result as ToolResult<ExportChartOutput>),
  },
}

// MCP tool annotations: a human-readable title plus behavior hints. Every tool
// here is deterministic and operates only on its input + bundled docs/samples
// (no network, no open world). `render` is the only one that can write to disk
// (via `save`), so it is the only non-read-only tool.
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  validate_dsl: { title: 'Validate .bpc', ...READ_ONLY },
  inspect_dsl: { title: 'Inspect .bpc', ...READ_ONLY },
  recommend_chart_type: { title: 'Recommend chart type', ...READ_ONLY },
  render: { title: 'Render chart', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  list_chart_types: { title: 'List chart types', ...READ_ONLY },
  describe_chart_type: { title: 'Describe chart type', ...READ_ONLY },
  get_example: { title: 'Get example chart', ...READ_ONLY },
  search_examples: { title: 'Search examples', ...READ_ONLY },
  list_palettes: { title: 'List palettes', ...READ_ONLY },
  get_grammar: { title: 'Get DSL grammar', ...READ_ONLY },
  export_chart: { title: 'Export chart', ...READ_ONLY },
}

export function createServer(): Server {
  const icons = buildServerIcons()
  const server = new Server(
    {
      name: '@blueprint-chart/mcp',
      title: 'Blueprint Chart',
      version: PKG.version,
      description: PKG.description,
      websiteUrl: PKG.homepage,
      ...(icons && { icons }),
    },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: zodToJsonSchema(def.inputSchema),
      ...(def.outputSchema && { outputSchema: zodToJsonSchema(def.outputSchema) }),
      ...(TOOL_ANNOTATIONS[name] && { annotations: TOOL_ANNOTATIONS[name] }),
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS[req.params.name]
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      }
    }
    const result = await tool.handler(req.params.arguments ?? {})
    return (tool.format ?? formatToolResult)(result)
  })

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(),
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const { uri } = req.params
    const doc = readResource(uri)
    return { contents: [{ uri: doc.uri, mimeType: doc.mimeType, text: doc.text }] }
  })

  const PROMPTS = {
    author_chart: authorChartPrompt(),
  }

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: Object.entries(PROMPTS).map(([name, p]) => ({
      name,
      description: p.description,
    })),
  }))

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const prompt = PROMPTS[req.params.name as keyof typeof PROMPTS]
    if (!prompt) {
      throw new Error(`Unknown prompt: ${req.params.name}`)
    }
    return prompt
  })

  return server
}
