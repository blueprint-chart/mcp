import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { samples } from '@blueprint-chart/lib'
import { createServer } from '../../src/server'
import { startHttp } from '../../src/transports/http'

const EXPORT_CHART_SOURCE = 'chart bar-vertical {\n  data {\n    "A" = 1\n  }\n}\n'
const EDITOR_URL = 'https://blueprintchart.com'

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
    const transport = new StreamableHTTPClientTransport(new URL(`${handle.url}/`))
    const client = new Client({ name: 't', version: '0' }, { capabilities: {} })
    await client.connect(transport)
    return await client.callTool({ name: 'validate_dsl', arguments: { source: samples[0]!.dsl } })
  }
  finally {
    await handle.close()
  }
}

async function callExportChartInMemory() {
  const server = createServer()
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: 't', version: '0' }, { capabilities: {} })
  await client.connect(clientT)
  return client.callTool({ name: 'export_chart', arguments: { source: EXPORT_CHART_SOURCE } })
}

async function callExportChartOverHttp() {
  const handle = await startHttp({ port: 0, silent: true })
  try {
    const transport = new StreamableHTTPClientTransport(new URL(`${handle.url}/`))
    const client = new Client({ name: 't', version: '0' }, { capabilities: {} })
    await client.connect(transport)
    return await client.callTool({ name: 'export_chart', arguments: { source: EXPORT_CHART_SOURCE } })
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

  describe('export_chart', () => {
    beforeEach(() => {
      process.env.BLUEPRINT_CHART_EDITOR_URL = EDITOR_URL
    })
    afterEach(() => {
      delete process.env.BLUEPRINT_CHART_EDITOR_URL
    })

    it('returns the same payload over in-memory and HTTP', async () => {
      const a = await callExportChartInMemory()
      const b = await callExportChartOverHttp()
      expect(b.content).toEqual(a.content)
      expect(Boolean(b.isError)).toBe(Boolean(a.isError))
    })
  })
})
