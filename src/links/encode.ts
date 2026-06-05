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

/**
 * Inverse of `toUrlSafeB64`. Rejects input containing characters outside the
 * url-safe alphabet so HTTP callers get a clean 400 instead of silent garbage
 * (Buffer.from is otherwise lenient about invalid base64).
 */
export function fromUrlSafeB64(input: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) {
    throw new Error('invalid url-safe base64 input')
  }
  const standard = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(standard, 'base64').toString('utf-8')
}
