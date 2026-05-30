import { toUrlSafeB64, toStandardB64 } from './encode'

export type DocUrlGroup = 'handbook' | 'guide' | 'charts' | 'reference/dsl' | 'reference/api'

/**
 * Editable "open & copy" deep-link: hydrates a fresh editor session.
 * The `/copy` route reads `bpc64` from the query string and decodes it as
 * URL-SAFE base64 (`decodeUrlSafeBase64`). `encodeURIComponent` mirrors the
 * editor/docs code; it is a no-op on url-safe base64 (alphabet is `[A-Za-z0-9-_]`)
 * but kept for fidelity. NOTE: distinct from `/render?bpc64=` below, which
 * decodes STANDARD base64 via `atob` despite the identical param name.
 */
export function buildCopyUrl(source: string, editorBase: string): string {
  return `${editorBase}/#/copy?bpc64=${encodeURIComponent(toUrlSafeB64(source))}`
}

/** Read-only render deep-link, suitable as an iframe `src` (standard base64). */
export function buildEmbedUrl(source: string, editorBase: string): string {
  return `${editorBase}/#/render?bpc64=${encodeURIComponent(toStandardB64(source))}`
}

/** Public docs page URL for a docs group + slug. */
export function buildDocUrl(group: DocUrlGroup, slug: string, docsBase: string): string {
  return `${docsBase}/${group}/${slug}`
}
