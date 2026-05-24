import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { validateDsl, ValidateInputSchema } from './tools/validate'
import { inspectDsl, InspectInputSchema } from './tools/inspect'
import { recommendChartType, RecommendInputSchema } from './tools/recommend'
import { renderTool, RenderInputSchema } from './tools/render'
import { listChartTypes, ListChartTypesInputSchema } from './tools/listChartTypes'
import { describeChartType, DescribeChartTypeInputSchema } from './tools/describeChartType'
import { getExample, GetExampleInputSchema } from './tools/getExample'
import { getGrammar, GetGrammarInputSchema } from './tools/getGrammar'
import { listResources, readResource } from './resources/index'
import { authorChartPrompt } from './prompts/authorChart'
import { zodToJsonSchema } from './lib/zodToJsonSchema'
import type { ToolResult } from './errors'

interface ToolDef {
  description: string
  inputSchema: Parameters<typeof zodToJsonSchema>[0]
  handler: (args: unknown) => ToolResult<unknown> | Promise<ToolResult<unknown>>
}

export const TOOLS: Record<string, ToolDef> = {
  validate_dsl: {
    description: 'Parse and semantically validate a .bpc source. Returns { valid, errors[], warnings[] }. Errors include unknown chart types, unknown properties, and empty data blocks with nearest-neighbour suggestions.',
    inputSchema: ValidateInputSchema,
    handler: args => validateDsl(args as { source: string }),
  },
  inspect_dsl: {
    description: 'Parse a .bpc source and return a structured summary: chartType, scenes, data (rowCount, entryCount, labels, seriesNames, multiSeries), annotation/colorize/highlight/area-fill presence flags, series count.',
    inputSchema: InspectInputSchema,
    handler: args => inspectDsl(args as { source: string }),
  },
  recommend_chart_type: {
    description: 'Given an array of column types and a row count, return ranked chart-type recommendations.',
    inputSchema: RecommendInputSchema,
    handler: args => recommendChartType(args),
  },
  render: {
    description: 'Render a .bpc source to SVG (default) or PNG. Accepts scene index, width, height.',
    inputSchema: RenderInputSchema,
    handler: args => renderTool(args),
  },
  list_chart_types: {
    description: 'List every chart type the renderer supports, with aliases and one-line summaries. Call this before writing .bpc if unsure which type to use.',
    inputSchema: ListChartTypesInputSchema,
    handler: () => listChartTypes(),
  },
  describe_chart_type: {
    description: 'Return everything an LLM needs to write a .bpc for a given chart type: summary, when-to-use, when-NOT-to-use, full property list with enum choices, data-shape example, and a pointer to a canonical sample.',
    inputSchema: DescribeChartTypeInputSchema,
    handler: args => describeChartType(args),
  },
  get_example: {
    description: 'Return a canonical .bpc example. Pass { name } for a specific sample id, { chartType } for the first sample of that type, or no args for a starter sample.',
    inputSchema: GetExampleInputSchema,
    handler: args => getExample(args),
  },
  get_grammar: {
    description: 'Return the .bpc DSL grammar as markdown. Pass { section: "chart" | "data" | "properties" | "scenes" | "annotations" } for a focused subset, or no args for the full grammar.',
    inputSchema: GetGrammarInputSchema,
    handler: args => getGrammar(args),
  },
}

interface FormattedToolResult {
  content: Array<{ type: 'text', text: string }>
  isError?: boolean
  [k: string]: unknown
}

function formatToolResult<T>(result: ToolResult<T>): FormattedToolResult {
  if (result.ok) {
    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
  }
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ code: result.code, errors: result.errors }, null, 2) }],
  }
}

export function createServer(): Server {
  const server = new Server(
    { name: '@blueprint-chart/mcp', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: zodToJsonSchema(def.inputSchema),
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
    return formatToolResult(result)
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
