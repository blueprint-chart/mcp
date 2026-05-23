import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { validateDsl, ValidateInputSchema } from './tools/validate'
import { inspectDsl, InspectInputSchema } from './tools/inspect'
import { recommendChartType, RecommendInputSchema } from './tools/recommend'
import { renderTool, RenderInputSchema } from './tools/render'
import { listAllResources, readResource } from './resources/docsReader'
import { zodToJsonSchema } from './lib/zodToJsonSchema'
import type { ToolResult } from './errors'

interface ToolDef {
  description: string
  inputSchema: Parameters<typeof zodToJsonSchema>[0]
  handler: (args: unknown) => ToolResult<unknown> | Promise<ToolResult<unknown>>
}

const TOOLS: Record<string, ToolDef> = {
  validate_dsl: {
    description: 'Parse a .bpc source string. Return ok or precise parse errors with line/column.',
    inputSchema: ValidateInputSchema,
    handler: args => validateDsl(args as { source: string }),
  },
  inspect_dsl: {
    description: 'Parse a .bpc source and return a structured summary: chartType, scenes, series count, annotations, etc.',
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
    resources: listAllResources(),
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const { uri } = req.params
    const doc = readResource(uri)
    return { contents: [{ uri: doc.uri, mimeType: doc.mimeType, text: doc.text }] }
  })

  return server
}
