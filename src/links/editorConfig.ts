function normalize(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return undefined
  }
  return trimmed.replace(/\/+$/, '')
}

/** Editor app base URL (e.g. https://blueprintchart.com), or undefined when unset. */
export function getEditorBaseUrl(): string | undefined {
  return normalize(process.env.BLUEPRINT_CHART_EDITOR_URL)
}

/** Docs site base URL (e.g. https://docs.blueprintchart.com), or undefined when unset. */
export function getDocsBaseUrl(): string | undefined {
  return normalize(process.env.BLUEPRINT_CHART_DOCS_URL)
}
