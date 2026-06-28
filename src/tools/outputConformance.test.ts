import { describe, it, expect, beforeAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../server'
import { ValidateOutputSchema } from './validate'
import { InspectOutputSchema } from './inspect'
import { RecommendOutputSchema } from './recommend'
import { ListChartTypesOutputSchema } from './listChartTypes'
import { DescribeChartTypeOutputSchema } from './describeChartType'
import { GetExampleOutputSchema } from './getExample'
import { SearchExamplesOutputSchema } from './searchExamples'
import { ListPalettesOutputSchema } from './listPalettes'
import { GetGrammarOutputSchema } from './getGrammar'

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

describe('output conformance: discovery/text tools', () => {
  it('list_chart_types conforms', async () => {
    const r = await client.callTool({ name: 'list_chart_types', arguments: {} })
    expect(() => ListChartTypesOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('describe_chart_type conforms', async () => {
    const r = await client.callTool({ name: 'describe_chart_type', arguments: { chartType: 'bar-horizontal' } })
    expect(() => DescribeChartTypeOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('get_example conforms', async () => {
    const r = await client.callTool({ name: 'get_example', arguments: { name: 'co2-emissions' } })
    expect(() => GetExampleOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('search_examples conforms', async () => {
    const r = await client.callTool({ name: 'search_examples', arguments: { query: 'co2' } })
    expect(() => SearchExamplesOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('list_palettes conforms', async () => {
    const r = await client.callTool({ name: 'list_palettes', arguments: {} })
    expect(() => ListPalettesOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
  it('get_grammar conforms', async () => {
    const r = await client.callTool({ name: 'get_grammar', arguments: {} })
    expect(() => GetGrammarOutputSchema.parse(r.structuredContent)).not.toThrow()
  })
})
