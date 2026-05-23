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
})
