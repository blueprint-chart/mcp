import { describe, expect, it } from 'vitest'
import { authorChartPrompt } from './authorChart'

describe('authorChartPrompt', () => {
  it('returns a non-empty prompt body with resource URIs', () => {
    const p = authorChartPrompt()
    expect(p.messages.length).toBeGreaterThan(0)
    const first = p.messages[0]!
    expect(first.role).toBe('user')
    expect(first.content.type).toBe('text')
    expect((first.content as { text: string }).text).toMatch(/bpc:\/\/grammar/)
    expect((first.content as { text: string }).text).toMatch(/validate_dsl/)
  })

  it('mentions export_chart and the export step', () => {
    const prompt = authorChartPrompt()
    const text = prompt.messages[0]!.content.text
    expect(text).toContain('export_chart')
    expect(text).toMatch(/copyUrl/)
  })

  it('makes recommend_chart_type the first workflow step, before list_chart_types', () => {
    const text = authorChartPrompt().messages[0]!.content.text
    expect(text).toMatch(/Always start with .?recommend_chart_type/)
    expect(text.indexOf('recommend_chart_type')).toBeLessThan(text.indexOf('list_chart_types'))
  })

  it('instructs passing the user goal and explains it decides the chart family', () => {
    const text = authorChartPrompt().messages[0]!.content.text
    expect(text).toMatch(/goal decides the chart family/i)
    expect(text).toMatch(/comparison.*ranking.*part-to-whole.*composition-over-time.*trend.*range/i)
  })

  it('contains the Restraint section with the chrome list and the metadata exemption', () => {
    const text = authorChartPrompt().messages[0]!.content.text
    expect(text).toMatch(/Restraint/)
    expect(text).toMatch(/Do NOT add .?valueLabels/)
    expect(text).toMatch(/unless the user asked/i)
    expect(text).toMatch(/Metadata is not chrome/)
    expect(text).toMatch(/handbook\/design-principles/)
  })

  it('demands the verbatim goal and permits a reasoned override', () => {
    const text = authorChartPrompt().messages[0]!.content.text
    expect(text).toMatch(/verbatim — do not paraphrase/)
    expect(text).toMatch(/say why/)
  })
})
