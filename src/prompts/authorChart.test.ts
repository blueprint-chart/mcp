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
})
