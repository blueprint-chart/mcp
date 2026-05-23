import { describe, expect, it } from 'vitest'
import { startHttp } from './http'

describe('http transport', () => {
  it('starts an HTTP server on a random port and responds to a tools/list', async () => {
    const { url, close } = await startHttp({ port: 0 })
    try {
      const res = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      })
      expect(res.status).toBeLessThan(500)
    } finally {
      await close()
    }
  })
})
