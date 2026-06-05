import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { samples } from '@blueprint-chart/lib'
import { createServer, TOOLS } from './server'
import { formatToolResult } from './toolContent'
import { ErrorCode, toolError, toolOk } from './errors'

async function connectInMemory() {
  const server = createServer()
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: 'test', version: '0' }, { capabilities: {} })
  await client.connect(clientT)
  return { client, server }
}

describe('TOOLS registry', () => {
  it('contains the eleven expected tool names', () => {
    expect(Object.keys(TOOLS).sort()).toEqual([
      'describe_chart_type',
      'export_chart',
      'get_example',
      'get_grammar',
      'inspect_dsl',
      'list_chart_types',
      'list_palettes',
      'recommend_chart_type',
      'render',
      'search_examples',
      'validate_dsl',
    ])
  })
})

describe('server', () => {
  it('lists 11 tools', async () => {
    const { client } = await connectInMemory()
    const r = await client.listTools()
    const names = r.tools.map(t => t.name).sort()
    expect(names).toEqual([
      'describe_chart_type',
      'export_chart',
      'get_example',
      'get_grammar',
      'inspect_dsl',
      'list_chart_types',
      'list_palettes',
      'recommend_chart_type',
      'render',
      'search_examples',
      'validate_dsl',
    ])
  })

  it('publishes JSON Schemas with concrete properties (not a permissive stub)', async () => {
    const { client } = await connectInMemory()
    const r = await client.listTools()
    for (const tool of r.tools) {
      const schema = tool.inputSchema as Record<string, unknown>
      expect(schema.type, `${tool.name}: schema.type`).toBe('object')
      // Discovery tools like list_chart_types take no params — their `properties`
      // object exists but is empty. Every other tool has at least one property.
      expect(schema.properties, `${tool.name}: schema.properties`).toBeDefined()
    }
    const validate = r.tools.find(t => t.name === 'validate_dsl')!
    const validateSchema = validate.inputSchema as { properties: Record<string, unknown>, required?: string[] }
    expect(validateSchema.properties.source).toBeDefined()
    expect(validateSchema.required).toEqual(['source'])

    const render = r.tools.find(t => t.name === 'render')!
    const renderSchema = render.inputSchema as { properties: Record<string, unknown> }
    expect(renderSchema.properties.format).toBeDefined()
    expect(renderSchema.properties.save).toBeDefined()
  })

  it('calls validate_dsl successfully for a sample', async () => {
    const { client } = await connectInMemory()
    const r = await client.callTool({
      name: 'validate_dsl',
      arguments: { source: samples[0]!.dsl },
    })
    expect(r.isError).toBeFalsy()
  })

  it('calls validate_dsl with parse error', async () => {
    const { client } = await connectInMemory()
    const r = await client.callTool({ name: 'validate_dsl', arguments: { source: '@@@' } })
    const content = r.content as Array<{ type: 'text', text: string }> | undefined
    const text = content?.[0]?.text ?? ''
    expect(text).toMatch(/E_PARSE/)
  })

  it('lists at least 30 resources across 5 URI families', async () => {
    const { client } = await connectInMemory()
    const r = await client.listResources()
    expect(r.resources.length).toBeGreaterThanOrEqual(30)
    const prefixes = new Set(r.resources.map(rs => rs.uri.split('/').slice(0, 3).join('/')))
    expect(prefixes.has('bpc://handbook')).toBe(true)
    expect(prefixes.has('bpc://guide')).toBe(true)
    expect(prefixes.has('bpc://chart-types')).toBe(true)
  })

  it('reads a handbook resource', async () => {
    const { client } = await connectInMemory()
    const list = await client.listResources()
    const handbook = list.resources.find(r => r.uri.startsWith('bpc://handbook/'))!
    const r = await client.readResource({ uri: handbook.uri })
    const first = r.contents[0] as { uri: string, mimeType?: string, text?: string }
    expect(first.text).toMatch(/.{50,}/)
  })

  it('exposes bpc://samples/<id> with .bpc content', async () => {
    const { client } = await connectInMemory()
    const list = await client.listResources()
    const sample = list.resources.find(r => r.uri.startsWith('bpc://samples/'))!
    const r = await client.readResource({ uri: sample.uri })
    const first = r.contents[0] as { text?: string, mimeType?: string }
    expect(first.text).toMatch(/chart\s+\w/)
  })

  describe('serverInfo metadata', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('always advertises title + dynamic version', async () => {
      vi.stubEnv('MCP_PUBLIC_URL', '')
      const { client } = await connectInMemory()
      const info = client.getServerVersion()
      expect(info?.title).toBe('Blueprint Chart')
      expect(info?.version).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('omits icons when MCP_PUBLIC_URL is unset (stdio / local use)', async () => {
      vi.stubEnv('MCP_PUBLIC_URL', '')
      const { client } = await connectInMemory()
      expect(client.getServerVersion()?.icons).toBeUndefined()
    })

    it('advertises absolute-URL icons when MCP_PUBLIC_URL is set', async () => {
      vi.stubEnv('MCP_PUBLIC_URL', 'https://mcp.example.com/')
      const { client } = await connectInMemory()
      const icons = client.getServerVersion()?.icons as Array<{ src: string, mimeType?: string, sizes?: string[] }> | undefined
      expect(icons).toEqual([
        { src: 'https://mcp.example.com/favicon.svg', mimeType: 'image/svg+xml' },
        { src: 'https://mcp.example.com/favicon.png', mimeType: 'image/png', sizes: ['256x256'] },
      ])
    })
  })

  it('exposes author_chart prompt', async () => {
    const { client } = await connectInMemory()
    const prompts = await client.listPrompts()
    expect(prompts.prompts.some(p => p.name === 'author_chart')).toBe(true)

    const got = await client.getPrompt({ name: 'author_chart' })
    expect(got.messages.length).toBeGreaterThan(0)
  })

  describe('export_chart', () => {
    const VALID_SOURCE = 'chart bar-vertical {\n  data {\n    "A" = 1\n  }\n}\n'

    afterEach(() => {
      delete process.env.BLUEPRINT_CHART_EDITOR_URL
    })

    it('appears in tools/list with an object-type inputSchema', async () => {
      const { client } = await connectInMemory()
      const r = await client.listTools()
      const tool = r.tools.find(t => t.name === 'export_chart')
      expect(tool).toBeDefined()
      expect((tool!.inputSchema as Record<string, unknown>).type).toBe('object')
    })

    it('returns E_CONFIG when BLUEPRINT_CHART_EDITOR_URL is unset', async () => {
      delete process.env.BLUEPRINT_CHART_EDITOR_URL
      const { client } = await connectInMemory()
      const res = await client.callTool({ name: 'export_chart', arguments: { source: VALID_SOURCE } })
      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toMatch(/E_CONFIG/)
    })

    it('returns copyUrl with #/copy?bpc64= when BLUEPRINT_CHART_EDITOR_URL is set', async () => {
      process.env.BLUEPRINT_CHART_EDITOR_URL = 'https://blueprintchart.com'
      const { client } = await connectInMemory()
      const res = await client.callTool({ name: 'export_chart', arguments: { source: VALID_SOURCE } })
      expect(res.isError).toBeFalsy()
      expect(JSON.stringify(res.content)).toMatch(/#\/copy\?bpc64=/)
    })
  })
})

describe('per-tool formatter dispatch', () => {
  it('formatToolResult emits a single text block with the JSON payload', () => {
    const r = formatToolResult(toolOk({ a: 1 }))
    expect(r.content).toHaveLength(1)
    expect(r.content[0]).toMatchObject({ type: 'text' })
  })

  it('formatToolResult marks errors and serializes code+errors', () => {
    const r = formatToolResult(toolError(ErrorCode.E_INPUT, [{ message: 'bad' }]))
    expect(r.isError).toBe(true)
    expect((r.content[0] as { text: string }).text).toContain('E_INPUT')
  })

  it('list_chart_types (no format override) returns all text blocks', async () => {
    const { client } = await connectInMemory()
    const res = await client.callTool({ name: 'list_chart_types', arguments: {} })
    const content = res.content as Array<{ type: string }>
    expect(content.every(c => c.type === 'text')).toBe(true)
  })

  it('render png via client returns an image block first', async () => {
    const { client } = await connectInMemory()
    const res = await client.callTool({ name: 'render', arguments: { source: 'chart bar-vertical {\n  data {\n    "A" = 1\n  }\n}\n', format: 'png' } })
    const content = res.content as Array<{ type: string }>
    expect(content[0]?.type).toBe('image')
    expect(content[1]?.type).toBe('text')
  })
})
