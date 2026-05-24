import { describe, expect, it } from 'vitest'
import { startHttp } from './http'

async function withServer<T>(
  opts: Parameters<typeof startHttp>[0],
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const handle = await startHttp({ silent: true, ...opts })
  try {
    return await fn(handle.url)
  }
  finally {
    await handle.close()
  }
}

describe('http transport', () => {
  it('responds to /mcp tools/list with status < 500', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      expect(res.status).toBeLessThan(500)
    })
  })

  it('serves /healthz returning {status:"ok"}', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/healthz`)
      expect(res.status).toBe(200)
      const body = await res.json() as { status?: string }
      expect(body.status).toBe('ok')
    })
  })

  it('returns 404 for unknown paths', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/nope`)
      expect(res.status).toBe(404)
    })
  })

  it('handles CORS preflight (OPTIONS)', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/mcp`, { method: 'OPTIONS' })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-methods')).toMatch(/POST/)
    })
  })

  it('rejects /mcp without token when authToken is set', async () => {
    await withServer({ port: 0, authToken: 'secret' }, async (url) => {
      const res = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      expect(res.status).toBe(401)
    })
  })

  it('accepts /mcp with correct bearer token', async () => {
    await withServer({ port: 0, authToken: 'secret' }, async (url) => {
      const res = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: 'Bearer secret',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      expect(res.status).toBeLessThan(500)
      expect(res.status).not.toBe(401)
    })
  })

  it('rate-limits /mcp by IP', async () => {
    await withServer({ port: 0, rateLimitPerMinute: 2 }, async (url) => {
      const hit = async () => fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      const first = await hit()
      const second = await hit()
      const third = await hit()
      expect(first.status).not.toBe(429)
      expect(second.status).not.toBe(429)
      expect(third.status).toBe(429)
      expect(third.headers.get('retry-after')).toBe('60')
    })
  })
})
