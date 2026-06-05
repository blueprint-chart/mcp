/**
 * Translates raw PEG parser messages from @blueprint-chart/lib into plain,
 * actionable guidance. The raw token-class messages (e.g.
 * `Expected "\t" or [^\t\n\r{}=] but "\n" found`) were the worst-rated error
 * in the authoring usability test — newcomers averaged 6.3 attempts-to-valid,
 * largely stuck on data syntax. Unknown messages pass through unchanged.
 */
export interface HumanizedError {
  message: string
  suggestion?: string
}

interface Rule {
  match: RegExp
  message: string
  suggestion?: string
}

const RULES: Rule[] = [
  {
    // The PEG message contains the literal two-char sequence backslash-t (e.g.
    // `Expected "\t" or [^\t\n\r{}=] ...`); \\t in this literal matches that
    // backslash-t, not an actual tab.
    match: /Expected .*\\t.* but .* found/,
    message: 'A data row must be written as `"Label" = value` (a quoted label, `=`, then the value). Multiple values per row are comma-separated.',
    suggestion: 'Single series: `"Asia" = 59.4`. Multi-series: add `series = "Gold","Silver"` then `"USA" = 40,44`.',
  },
  {
    match: /Expected whitespace but ":" found/,
    message: 'The chart declaration uses a block, not a colon. Write `chart <type> { … }`.',
    suggestion: 'chart donut {\n  data { "A" = 1 }\n}',
  },
  {
    match: /Expected (?:"chart"|end of input)[^"]*but "d" found/,
    message: 'The `data { … }` block must be nested inside the chart block, not at the top level.',
    suggestion: 'chart bar-vertical {\n  data { "A" = 1 }\n}',
  },
  {
    match: /Expected "=" .* but ":" found/,
    message: 'Properties use `=`, not `:`. Write `title = "…"`.',
  },
]

export function humanizeParseError(raw: string): HumanizedError {
  for (const rule of RULES) {
    if (rule.match.test(raw)) {
      return { message: rule.message, suggestion: rule.suggestion }
    }
  }
  return { message: raw }
}
