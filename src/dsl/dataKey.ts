import type { PropertyNode } from '@blueprint-chart/lib'

/**
 * Heuristic for "data key is unquoted identifier-shaped." The lib's PropertyNode
 * exposes `quotedKey` ONLY for the `series` collision case (a quoted `"series"`
 * data row vs. the unquoted `series = …` meta-row); there is still no general
 * per-key isQuoted flag. We fall back to a regex match against the Identifier
 * production from grammar.peggy for every other key.
 *
 * The Identifier production is: [a-zA-Z_#][a-zA-Z0-9_#-]*
 *
 * Since the parsed PropertyNode carries no general isQuoted flag, we cannot
 * distinguish `"China" = 5` from `China = 5` purely from the AST. We tighten the
 * heuristic by only flagging keys that start with a lowercase letter — real data
 * labels in shipped samples always start with an uppercase letter, a digit, or
 * `_`. A camelCase-starting key (e.g. `unquotedKey`) is a strong signal that the
 * user typed a property key as if it were a chart-level option.
 */
export function looksLikeUnquotedKey(entry: PropertyNode): boolean {
  const k = entry.key
  // A quoted `"series"` data row is a real category, never an unquoted key.
  if (k === 'series' && entry.quotedKey === true) {
    return false
  }
  const tagged = (entry as unknown as { isQuoted?: boolean }).isQuoted
  if (typeof tagged === 'boolean') {
    return !tagged
  }
  // Only flag identifiers that start with a lowercase letter — proper-noun labels
  // and abbreviations used as data row labels always start with uppercase or `_`.
  return /^[a-z][A-Za-z0-9_#-]*$/.test(k)
}

/**
 * Inverse of `looksLikeUnquotedKey`, with an additional exclusion of the
 * `series` meta-row (which names columns, not a row label). A quoted `"series"`
 * row IS a real data category, so we only exclude the unquoted meta-row.
 *
 * Quoted-label-shaped means: proper nouns, digit-leading, hyphen/underscore-
 * leading — anything that does NOT start with a lowercase letter.
 */
export function looksLikeQuotedLabel(entry: PropertyNode): boolean {
  if (entry.key === 'series') {
    // The unquoted `series` meta-row names columns; a quoted `"series"` row is a
    // real data category. `quotedKey` is the only signal that disambiguates them.
    return entry.quotedKey === true
  }
  const tagged = (entry as unknown as { isQuoted?: boolean }).isQuoted
  if (typeof tagged === 'boolean') {
    return tagged
  }
  return !/^[a-z][A-Za-z0-9_#-]*$/.test(entry.key)
}
