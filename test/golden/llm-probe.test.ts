import { describe, expect, it } from 'vitest'
import { listChartTypes } from '../../src/tools/listChartTypes'
import { describeChartType } from '../../src/tools/describeChartType'
import { getExample } from '../../src/tools/getExample'
import { renderTool } from '../../src/tools/render'

describe('LLM-shaped probe — three-call convergence', () => {
  it('renders a chart starting only from a chartType', async () => {
    // Call 1: discover what's available
    const list = listChartTypes()
    expect(list.ok).toBe(true)
    if (!list.ok) {
      return
    }

    // Call 2: get a canonical example
    const ex = getExample({ chartType: 'bar-vertical' })
    expect(ex.ok).toBe(true)
    if (!ex.ok) {
      return
    }

    // Call 3: render it
    const rendered = await renderTool({ source: ex.data.dsl, format: 'svg' })
    expect(rendered.ok).toBe(true)
    if (rendered.ok) {
      expect(rendered.data.svg.length).toBeGreaterThan(100)
    }
  })

  it('describe_chart_type → get_example → render also converges', async () => {
    const desc = describeChartType({ name: 'bar-horizontal' })
    expect(desc.ok).toBe(true)
    if (!desc.ok || !desc.data.exampleSlug) {
      return
    }

    const ex = getExample({ name: desc.data.exampleSlug })
    expect(ex.ok).toBe(true)
    if (!ex.ok) {
      return
    }

    const rendered = await renderTool({ source: ex.data.dsl, format: 'svg' })
    expect(rendered.ok).toBe(true)
  })

  it('chart bar fails fast with a usable suggestion', async () => {
    const r = await renderTool({ source: 'chart bar { data { "E" = 1 } }' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_UNKNOWN_CHART_TYPE')
      expect(r.errors[0]!.suggestion).toMatch(/^bar-/)
    }
  })
})
