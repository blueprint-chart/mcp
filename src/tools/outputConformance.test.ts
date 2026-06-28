import { describe, it, expect, beforeAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../server'
import { ValidateOutputSchema } from './validate'
import { InspectOutputSchema } from './inspect'
import { RecommendOutputSchema } from './recommend'

let client: Client
beforeAll(async () => {
  const server = createServer()
  const [c, s] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 't', version: '0' }, { capabilities: {} })
  await Promise.all([server.connect(s), client.connect(c)])
})

const BAR = 'chart bar-vertical {\n  data { "A" = 1\n "B" = 2 }\n}'

describe('output conformance: validate/inspect/recommend', () => {
  it('validate_dsl structuredContent conforms', async () => {
    const r = await client.callTool({ name: 'validate_dsl', arguments: { source: BAR } })
    expect(() => ValidateOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('inspect_dsl structuredContent conforms', async () => {
    const r = await client.callTool({ name: 'inspect_dsl', arguments: { source: BAR } })
    expect(() => InspectOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('recommend_chart_type structuredContent conforms', async () => {
    const r = await client.callTool({ name: 'recommend_chart_type', arguments: { columnTypes: ['string', 'number'], rowCount: 2 } })
    expect(() => RecommendOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
})
