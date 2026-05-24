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
  it('responds to /mcp tools/list after establishing SSE', async () => {
    await withServer({ port: 0 }, async (url) => {
      // 1. Establish SSE session
      const sseRes = await fetch(`${url}/mcp`, {
        headers: { 'accept': 'text/event-stream' },
      })
      expect(sseRes.status).toBe(200)
      
      const reader = sseRes.body?.getReader()
      if (!reader) throw new Error('No reader')
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      const sessionIdMatch = text.match(/sessionId=([a-zA-Z0-9-]+)/)
      if (!sessionIdMatch) throw new Error(`No sessionId in SSE: ${text}`)
      const sessionId = sessionIdMatch[1]

      // 2. Post message using sessionId
      const res = await fetch(`${url}/mcp?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      expect(res.status).toBe(202) // SSEServerTransport returns 202 for POSTs

      // Cleanup
      await reader.cancel()
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

  it('returns 404 for / by default', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/`)
      expect(res.status).toBe(404)
    })
  })

  it('redirects / to rootRedirectUrl when set', async () => {
    const rootRedirectUrl = 'https://example.com'
    await withServer({ port: 0, rootRedirectUrl }, async (url) => {
      const res = await fetch(`${url}/`, { redirect: 'manual' })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe(rootRedirectUrl)
    })
  })

  it('handles CORS preflight (OPTIONS)', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/mcp`, { method: 'OPTIONS' })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-methods')).toMatch(/POST/)
    })
  })

  it('rejects /mcp POST without sessionId', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      // The transport returns 406 (Not Acceptable) because it's not an initialization request
      // and lacks a session ID header.
      expect(res.status).toBe(406)
    })
  })

  it('rejects /mcp POST with invalid sessionId', async () => {
    await withServer({ port: 0 }, async (url) => {
      const res = await fetch(`${url}/mcp?sessionId=nope`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      expect(res.status).toBe(400)
    })
  })

  it('rejects SSE without token when authToken is set', async () => {
    await withServer({ port: 0, authToken: 'secret' }, async (url) => {
      const res = await fetch(`${url}/mcp`, {
        headers: { 'accept': 'text/event-stream' },
      })
      expect(res.status).toBe(401)
    })
  })

  it('accepts SSE with correct bearer token', async () => {
    await withServer({ port: 0, authToken: 'secret' }, async (url) => {
      const res = await fetch(`${url}/mcp`, {
        headers: {
          'accept': 'text/event-stream',
          'authorization': 'Bearer secret',
        },
      })
      expect(res.status).toBe(200)
      await res.body?.cancel()
    })
  })

  it('rate-limits /mcp by IP', async () => {
    await withServer({ port: 0, rateLimitPerMinute: 2 }, async (url) => {
      const hit = async () => fetch(`${url}/mcp`, {
        headers: { 'accept': 'text/event-stream' },
      })
      const first = await hit()
      const second = await hit()
      const third = await hit()
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(third.status).toBe(429)
      await first.body?.cancel()
      await second.body?.cancel()
    })
  })
})
