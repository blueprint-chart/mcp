import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { samples } from '@blueprint-chart/lib'
import { createServer } from '../../src/server'
import { startHttp } from '../../src/transports/http'

async function callInMemory() {
  const server = createServer()
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: 't', version: '0' }, { capabilities: {} })
  await client.connect(clientT)
  return client.callTool({ name: 'validate_dsl', arguments: { source: samples[0]!.dsl } })
}

async function callOverHttp() {
  const handle = await startHttp({ port: 0, silent: true })
  try {
    const transport = new StreamableHTTPClientTransport(new URL(`${handle.url}/mcp`))
    const client = new Client({ name: 't', version: '0' }, { capabilities: {} })
    await client.connect(transport)
    return await client.callTool({ name: 'validate_dsl', arguments: { source: samples[0]!.dsl } })
  }
  finally {
    await handle.close()
  }
}

describe('transport parity', () => {
  it('validate_dsl returns the same payload over in-memory and HTTP', async () => {
    const a = await callInMemory()
    const b = await callOverHttp()
    expect(b.content).toEqual(a.content)
    expect(Boolean(b.isError)).toBe(Boolean(a.isError))
  })
})
