import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createRenderRoutesHandler, isRenderRoute, RENDER_BPC64_MAX_LENGTH } from './renderRoutes'
import { renderChart } from '../render/renderChart'
import { createRenderCache } from '../render/renderCache'
import { toUrlSafeB64 } from '../links/encode'

const VALID = 'chart bar-vertical {\n  title = "Hi"\n  data {\n    "A" = 1\n  }\n}\n'
const B64 = encodeURIComponent(toUrlSafeB64(VALID))

function makeHandler(overrides: Partial<Parameters<typeof createRenderRoutesHandler>[0]> = {}) {
  return createRenderRoutesHandler({
    renderChart,
    cache: createRenderCache(),
    consumeRateLimit: () => true,
    withSlot: fn => fn(),
    version: '0.0.0-test',
    log: () => {},
    ...overrides,
  })
}

/** Spin a raw http server around the handler and fetch from it. */
async function request(handler: ReturnType<typeof createRenderRoutesHandler>, path: string, headers: Record<string, string> = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    await handler(req, res, url, '127.0.0.1')
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as { port: number }
  try {
    return await fetch(`http://127.0.0.1:${addr.port}${path}`, { headers })
  }
  finally {
    server.closeAllConnections?.()
    await new Promise(r => server.close(r))
  }
}

describe('isRenderRoute', () => {
  it('matches only the three render paths', () => {
    expect(isRenderRoute('/render.png')).toBe(true)
    expect(isRenderRoute('/render.svg')).toBe(true)
    expect(isRenderRoute('/render.bpc')).toBe(true)
    expect(isRenderRoute('/render.gif')).toBe(false)
    expect(isRenderRoute('/')).toBe(false)
  })
})

describe('render routes', () => {
  it('serves PNG with immutable cache headers and a stable ETag', async () => {
    const handler = makeHandler()
    const res = await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    const etag = res.headers.get('etag')
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/)
    const res2 = await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    expect(res2.headers.get('etag')).toBe(etag) // ETag stability
  })

  it('ETag changes with version (honest across releases)', async () => {
    const a = await request(makeHandler({ version: '1.0.0' }), `/render.bpc?bpc64=${B64}`)
    const b = await request(makeHandler({ version: '1.0.1' }), `/render.bpc?bpc64=${B64}`)
    expect(a.headers.get('etag')).not.toBe(b.headers.get('etag'))
  })

  it('answers 304 to a matching If-None-Match without rendering', async () => {
    const spy = vi.fn(renderChart)
    const handler = makeHandler({ renderChart: spy })
    const first = await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    const etag = first.headers.get('etag')!
    const second = await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`, { 'if-none-match': etag })
    expect(second.status).toBe(304)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('serves the second identical GET from cache (single core render)', async () => {
    const spy = vi.fn(renderChart)
    const handler = makeHandler({ renderChart: spy })
    await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('render.svg returns image/svg+xml, render.bpc returns the decoded source', async () => {
    const handler = makeHandler()
    const svg = await request(handler, `/render.svg?bpc64=${B64}`)
    expect(svg.headers.get('content-type')).toBe('image/svg+xml')
    const bpc = await request(handler, `/render.bpc?bpc64=${B64}`)
    expect(bpc.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await bpc.text()).toBe(VALID)
  })

  it('400s on missing/garbage bpc64 and on invalid DSL, with a JSON envelope', async () => {
    const handler = makeHandler()
    expect((await request(handler, '/render.png')).status).toBe(400)
    expect((await request(handler, '/render.png?bpc64=%24%24')).status).toBe(400)
    const badDsl = encodeURIComponent(toUrlSafeB64('chart nope {'))
    const res = await request(handler, `/render.png?bpc64=${badDsl}`)
    expect(res.status).toBe(400)
    const body = await res.json() as { code: string }
    expect(body.code).toBeDefined()
  })

  it('413s when bpc64 exceeds RENDER_BPC64_MAX_LENGTH', async () => {
    const handler = makeHandler()
    const huge = 'A'.repeat(RENDER_BPC64_MAX_LENGTH + 1)
    expect((await request(handler, `/render.png?bpc64=${huge}`)).status).toBe(413)
  })

  it('429s with Retry-After when the rate limit is exhausted', async () => {
    const handler = makeHandler({ consumeRateLimit: () => false })
    const res = await request(handler, `/render.png?bpc64=${B64}`)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
  })

  it('serves a cached URL without spending a token (cache lookup precedes the limit)', async () => {
    // Allow exactly the first request (which renders + populates the cache),
    // deny everything after — the second request must still hit the cache.
    let allowed = 1
    const handler = makeHandler({ consumeRateLimit: () => allowed-- > 0 })
    const first = await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    expect(first.status).toBe(200)
    const second = await request(handler, `/render.png?bpc64=${B64}&width=400&height=250`)
    expect(second.status).toBe(200) // served from cache, no token required
  })

  it('clamps width/height to the core maximum instead of erroring', async () => {
    const handler = makeHandler()
    const res = await request(handler, `/render.png?bpc64=${B64}&width=99999`)
    expect(res.status).toBe(200) // clampDimension handles it inside the core
  })

  it('400s when scene param is non-numeric (e.g. scene=abc)', async () => {
    const handler = makeHandler()
    const res = await request(handler, `/render.png?bpc64=${B64}&scene=abc`)
    expect(res.status).toBe(400)
    const body = await res.json() as { code: string, errors: Array<{ path: string }> }
    expect(body.code).toBe('E_INPUT')
    expect(body.errors[0]?.path).toBe('scene')
  })
})
