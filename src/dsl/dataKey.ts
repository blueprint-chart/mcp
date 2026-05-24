import type { PropertyNode } from '@blueprint-chart/lib'

/**
 * Heuristic for "data key is unquoted identifier-shaped." The lib's PropertyNode
 * tagged quoted-string keys via an isQuoted boolean in older grammar versions,
 * but the installed lib (v0.1.19) does not consistently expose it. We fall back
 * to a regex match against the Identifier production from grammar.peggy.
 *
 * The Identifier production is: [a-zA-Z_#][a-zA-Z0-9_#-]*
 *
 * However, since parsed PropertyNode has no isQuoted flag, we cannot distinguish
 * `"China" = 5` from `China = 5` purely from the AST. We tighten the heuristic
 * by only flagging keys that start with a lowercase letter — real data labels in
 * shipped samples always start with an uppercase letter, a digit, or `_`. A
 * camelCase-starting key (e.g. `unquotedKey`) is a strong signal that the user
 * typed a property key as if it were a chart-level option.
 */
export function looksLikeUnquotedKey(entry: PropertyNode): boolean {
  const k = entry.key
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
 * `_series` pseudo-key (which is a multi-series header, not a row label).
 *
 * Quoted-label-shaped means: proper nouns, digit-leading, hyphen/underscore-
 * leading — anything that does NOT start with a lowercase letter.
 */
export function looksLikeQuotedLabel(entry: PropertyNode): boolean {
  if (entry.key === '_series') {
    return false
  }
  const tagged = (entry as unknown as { isQuoted?: boolean }).isQuoted
  if (typeof tagged === 'boolean') {
    return tagged
  }
  return !/^[a-z][A-Za-z0-9_#-]*$/.test(entry.key)
}
