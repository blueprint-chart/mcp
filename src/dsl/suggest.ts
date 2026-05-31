function distance(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  if (a.length === 0) {
    return b.length
  }
  if (b.length === 0) {
    return a.length
  }

  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) {
    dp[i]![0] = i
  }
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const deletion = dp[i - 1]![j]! + 1
      const insertion = dp[i]![j - 1]! + 1
      const substitution = dp[i - 1]![j - 1]! + cost
      dp[i]![j] = Math.min(deletion, insertion, substitution)
    }
  }

  return dp[m]![n]!
}

const DEFAULT_MAX_DISTANCE = 10

/**
 * Hand-curated synonyms for property keys authors commonly guess wrong but that
 * are too edit-distant for the Levenshtein scan to catch. `subtitle` is the
 * canonical example: authors reach for it constantly, but the real key is
 * `description` (distance 7), so the distance scan wrongly suggests `title`.
 */
const SYNONYMS: Readonly<Record<string, string>> = {
  subtitle: 'description',
  subhead: 'description',
  subheading: 'description',
  author: 'byline',
  credit: 'byline',
  caption: 'note',
  footnote: 'note',
}

export function nearestSuggestion(
  input: string,
  candidates: readonly string[],
  maxDistance = DEFAULT_MAX_DISTANCE,
): string | undefined {
  const synonym = SYNONYMS[input]
  if (synonym && candidates.includes(synonym)) {
    return synonym
  }

  let best: { name: string, dist: number, score: number } | undefined
  for (const cand of candidates) {
    const d = distance(input, cand)
    if (d > maxDistance) {
      continue
    }
    // Prefer candidates that start with the input (prefix match bonus)
    const prefixBonus = cand.startsWith(input) ? -1000 : 0
    const score = d + prefixBonus
    if (!best || score < best.score || (score === best.score && cand < best.name)) {
      best = { name: cand, dist: d, score }
    }
  }
  return best?.name
}
