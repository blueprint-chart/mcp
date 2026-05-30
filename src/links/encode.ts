/**
 * RFC 4648 §5 url-safe base64 with padding stripped — the encoding the editor's
 * `/#/copy?bpc64=` route decodes (via `decodeUrlSafeBase64`). Mirrors
 * `toUrlSafeB64` in the editor/docs.
 */
export function toUrlSafeB64(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Standard (padded) base64 — the form the editor's `/#/render?bpc64=` route
 * decodes via `atob`. Callers must `encodeURIComponent` it for the query string.
 */
export function toStandardB64(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64')
}
