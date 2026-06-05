import { describe, expect, it } from 'vitest'
import { humanizeParseError } from './parseErrorHints'

describe('humanizeParseError', () => {
  // Real lib message (with trailing period): 'Expected "\t" or [^\t\n\r{}=] but "\n" found.'
  it('explains the tab/delimiter error for data rows', () => {
    const h = humanizeParseError('Expected "\\t" or [^\\t\\n\\r{}=] but "\\n" found.')
    expect(h.message).toMatch(/data row/i)
    expect(h.suggestion).toMatch(/series|comma/i)
  })

  // Real lib message (with trailing period): 'Expected whitespace but ":" found.'
  it('explains a YAML-style chart declaration', () => {
    const h = humanizeParseError('Expected whitespace but ":" found.')
    expect(h.message).toMatch(/chart <type> \{/i)
  })

  // Real lib message: 'Expected "chart" or optional whitespace but "d" found.'
  // (data block written at the top level, not inside a chart block)
  it('explains data at the top level', () => {
    const h = humanizeParseError('Expected "chart" or optional whitespace but "d" found.')
    expect(h.message).toMatch(/inside the chart block/i)
  })

  it('passes unknown messages through unchanged', () => {
    const h = humanizeParseError('something totally different')
    expect(h.message).toBe('something totally different')
    expect(h.suggestion).toBeUndefined()
  })

  // lib 0.1.30 emits its own friendly messages for some structural errors.
  // The humanizer must NOT rewrite or swallow them — they pass through verbatim.
  it('passes the lib duplicate-data-block message through unchanged', () => {
    const raw = 'duplicate data block — a chart or scene may define at most one data { } block'
    const h = humanizeParseError(raw)
    expect(h.message).toBe(raw)
    expect(h.suggestion).toBeUndefined()
  })
})
