import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { samples } from '@blueprint-chart/lib'
import { createServer } from './server'

async function connectInMemory() {
  const server = createServer()
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: 'test', version: '0' }, { capabilities: {} })
  await client.connect(clientT)
  return { client, server }
}

describe('server', () => {
  it('lists 4 tools', async () => {
    const { client } = await connectInMemory()
    const r = await client.listTools()
    const names = r.tools.map(t => t.name).sort()
    expect(names).toEqual(['inspect_dsl', 'recommend_chart_type', 'render', 'validate_dsl'])
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

  it('exposes author_chart prompt', async () => {
    const { client } = await connectInMemory()
    const prompts = await client.listPrompts()
    expect(prompts.prompts.some(p => p.name === 'author_chart')).toBe(true)

    const got = await client.getPrompt({ name: 'author_chart' })
    expect(got.messages.length).toBeGreaterThan(0)
  })
})
