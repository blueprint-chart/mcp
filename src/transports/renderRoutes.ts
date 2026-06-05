import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fromUrlSafeB64 } from '../links/encode.js'
import type { RenderChartResult, RenderChartOptions } from '../render/renderChart.js'
import type { RenderCache } from '../render/renderCache.js'

export const RENDER_ROUTES = ['/render.png', '/render.svg', '/render.bpc'] as const
export type RenderRoute = (typeof RENDER_ROUTES)[number]

/**
 * 8 KB cap on the encoded source — bounds input size before any work.
 * Kept well under Node.js's default 16 KB request-line limit so the
 * handler (not the HTTP parser) is the one that enforces the 413.
 */
export const RENDER_BPC64_MAX_LENGTH = 8 * 1024

export function isRenderRoute(pathname: string): pathname is RenderRoute {
  return (RENDER_ROUTES as readonly string[]).includes(pathname)
}

export interface RenderRoutesDeps {
  renderChart: (source: string, opts: RenderChartOptions) => Promise<RenderChartResult>
  /** undefined = caching disabled */
  cache: RenderCache | undefined
  /** Per-IP token consumption for the render-route limiter (default-on). */
  consumeRateLimit: (ip: string) => boolean
  /** Wraps the render in the transport's concurrency slot (the Semaphore). */
  withSlot: <T>(fn: () => Promise<T>) => Promise<T>
  /** Package version — part of the ETag so 304s stay honest across releases. */
  version: string
  log: (fields: Record<string, unknown>) => void
}

function send(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
  extraHeaders: Record<string, string> = {},
): void {
  res.statusCode = status
  // RFC 7232: a 304 carries no body — pass '' to skip the Content-Type header.
  if (contentType) {
    res.setHeader('Content-Type', contentType)
  }
  res.setHeader('X-Content-Type-Options', 'nosniff')
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v)
  }
  res.end(body)
}

function cacheHeaders(etag: string): Record<string, string> {
  return { 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': etag }
}

/**
 * Stateless render endpoints: the DSL travels url-safe-base64-encoded in the
 * query string; identical URL + identical server version ⇒ identical bytes.
 * Returns a handler that fully answers any GET whose pathname isRenderRoute().
 */
export function createRenderRoutesHandler(deps: RenderRoutesDeps) {
  return async function handleRenderRoute(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    ip: string,
  ): Promise<void> {
    const pathname = url.pathname as RenderRoute
    const rawB64 = url.searchParams.get('bpc64')

    if (!rawB64) {
      send(res, 400, 'application/json', JSON.stringify({
        code: 'E_INPUT',
        errors: [{ path: 'bpc64', message: 'bpc64 query parameter is required' }],
      }))
      return
    }
    if (rawB64.length > RENDER_BPC64_MAX_LENGTH) {
      send(res, 413, 'application/json', JSON.stringify({
        code: 'E_INPUT',
        errors: [{ path: 'bpc64', message: `bpc64 exceeds the ${RENDER_BPC64_MAX_LENGTH}-character limit` }],
      }))
      return
    }

    // Validate numeric query params before any rendering work.
    const sceneRaw = url.searchParams.get('scene')
    const widthRaw = url.searchParams.get('width')
    const heightRaw = url.searchParams.get('height')

    if (sceneRaw !== null && sceneRaw !== '' && Number.isNaN(Number(sceneRaw))) {
      send(res, 400, 'application/json', JSON.stringify({
        code: 'E_INPUT',
        errors: [{ path: 'scene', message: 'scene must be a number' }],
      }))
      return
    }
    if (widthRaw !== null && widthRaw !== '' && Number.isNaN(Number(widthRaw))) {
      send(res, 400, 'application/json', JSON.stringify({
        code: 'E_INPUT',
        errors: [{ path: 'width', message: 'width must be a number' }],
      }))
      return
    }
    if (heightRaw !== null && heightRaw !== '' && Number.isNaN(Number(heightRaw))) {
      send(res, 400, 'application/json', JSON.stringify({
        code: 'E_INPUT',
        errors: [{ path: 'height', message: 'height must be a number' }],
      }))
      return
    }

    // Canonical query (fixed param order) so the ETag is insensitive to param ordering.
    const scene = sceneRaw ?? ''
    const width = widthRaw ?? ''
    const height = heightRaw ?? ''
    const canonical = `${deps.version}|${pathname}|${rawB64}|${scene}|${width}|${height}`
    const etag = `"${createHash('sha256').update(canonical).digest('hex')}"`

    if (req.headers['if-none-match'] === etag) {
      send(res, 304, '', '', cacheHeaders(etag))
      return
    }

    // Cheap cache hits never cost a token — only render work does (mirrors the
    // free 304 path above). The lookup must therefore precede the rate limit.
    const cached = deps.cache?.get(etag)
    if (cached) {
      send(res, 200, cached.contentType, cached.body, cacheHeaders(etag))
      return
    }

    if (!deps.consumeRateLimit(ip)) {
      deps.log({ event: 'render_rate_limited', ip, path: pathname })
      send(res, 429, 'application/json', JSON.stringify({ error: 'Too Many Requests' }), { 'Retry-After': '60' })
      return
    }

    let source: string
    try {
      source = fromUrlSafeB64(rawB64)
    }
    catch {
      send(res, 400, 'application/json', JSON.stringify({
        code: 'E_INPUT',
        errors: [{ path: 'bpc64', message: 'bpc64 is not valid url-safe base64' }],
      }))
      return
    }

    // For /render.bpc: use svg format (cheaper — no rasterisation) for validation only;
    // the response body is the decoded source, not the render output.
    const renderFormat = pathname === '/render.png' ? 'png' : 'svg'
    const opts: RenderChartOptions = {
      format: renderFormat,
      scene: scene === '' ? undefined : Number(scene),
      width: width === '' ? 800 : Number(width),
      height: height === '' ? 500 : Number(height),
    }

    const rendered = await deps.withSlot(() => deps.renderChart(source, opts))
    if (!rendered.ok) {
      send(res, 400, 'application/json', JSON.stringify({
        code: rendered.error.code,
        errors: rendered.error.errors,
      }))
      return
    }

    const body: Buffer = pathname === '/render.bpc'
      ? Buffer.from(source, 'utf-8')
      : Buffer.isBuffer(rendered.body) ? rendered.body : Buffer.from(rendered.body as string, 'utf-8')
    const contentType = pathname === '/render.bpc' ? 'text/plain; charset=utf-8' : rendered.contentType

    deps.cache?.set(etag, { body, contentType })
    deps.log({ event: 'render_route', ip, path: pathname, bytes: body.byteLength })
    send(res, 200, contentType, body, cacheHeaders(etag))
  }
}
