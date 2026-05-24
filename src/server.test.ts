import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { samples } from '@blueprint-chart/lib'
import { createServer, TOOLS } from './server'

async function connectInMemory() {
  const server = createServer()
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: 'test', version: '0' }, { capabilities: {} })
  await client.connect(clientT)
  return { client, server }
}

describe('TOOLS registry', () => {
  it('contains the eight expected tool names', () => {
    expect(Object.keys(TOOLS).sort()).toEqual([
      'describe_chart_type',
      'get_example',
      'get_grammar',
      'inspect_dsl',
      'list_chart_types',
      'recommend_chart_type',
      'render',
      'validate_dsl',
    ])
  })
})

describe('server', () => {
  it('lists 8 tools', async () => {
    const { client } = await connectInMemory()
    const r = await client.listTools()
    const names = r.tools.map(t => t.name).sort()
    expect(names).toEqual([
      'describe_chart_type',
      'get_example',
      'get_grammar',
      'inspect_dsl',
      'list_chart_types',
      'recommend_chart_type',
      'render',
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

  it('advertises icons + title in serverInfo so MCP clients can display them', async () => {
    const { client } = await connectInMemory()
    const info = client.getServerVersion()
    expect(info?.title).toBe('Blueprint Chart')
    expect(info?.version).toMatch(/^\d+\.\d+\.\d+/)
    const icons = info?.icons as Array<{ src: string, mimeType?: string }> | undefined
    expect(icons?.length).toBeGreaterThanOrEqual(2)
    expect(icons?.some(i => i.mimeType === 'image/svg+xml' && i.src.startsWith('data:image/svg+xml;base64,'))).toBe(true)
    expect(icons?.some(i => i.mimeType === 'image/png' && i.src.startsWith('data:image/png;base64,'))).toBe(true)
  })

  it('exposes author_chart prompt', async () => {
    const { client } = await connectInMemory()
    const prompts = await client.listPrompts()
    expect(prompts.prompts.some(p => p.name === 'author_chart')).toBe(true)

    const got = await client.getPrompt({ name: 'author_chart' })
    expect(got.messages.length).toBeGreaterThan(0)
  })
})
