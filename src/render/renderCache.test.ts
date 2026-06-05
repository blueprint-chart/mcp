import { afterEach, describe, expect, it } from 'vitest'
import { createRenderCache } from './renderCache'

describe('createRenderCache', () => {
  afterEach(() => {
    delete process.env.MCP_RENDER_CACHE_MAX_BYTES
    delete process.env.MCP_RENDER_CACHE_TTL_SECONDS
  })

  it('stores and retrieves entries', () => {
    const cache = createRenderCache()
    cache!.set('k', { body: Buffer.from('png'), contentType: 'image/png' })
    expect(cache!.get('k')?.contentType).toBe('image/png')
  })

  it('evicts by byte budget', () => {
    process.env.MCP_RENDER_CACHE_MAX_BYTES = '300'
    const cache = createRenderCache()
    cache!.set('a', { body: Buffer.alloc(150), contentType: 'image/png' })
    cache!.set('b', { body: Buffer.alloc(150), contentType: 'image/png' })
    expect(cache!.get('a')).toBeUndefined() // LRU evicted to fit b
    expect(cache!.get('b')).toBeDefined()
  })

  it('returns undefined (disabled) when MCP_RENDER_CACHE_MAX_BYTES=0', () => {
    process.env.MCP_RENDER_CACHE_MAX_BYTES = '0'
    expect(createRenderCache()).toBeUndefined()
  })

  it('treats an empty env var as unset (default budget, cache enabled)', () => {
    process.env.MCP_RENDER_CACHE_MAX_BYTES = ''
    expect(createRenderCache()).toBeDefined()
  })

  it('expires entries after the TTL', async () => {
    process.env.MCP_RENDER_CACHE_TTL_SECONDS = '0.05' // 50ms for the test
    const cache = createRenderCache()
    cache!.set('k', { body: Buffer.from('x'), contentType: 'image/png' })
    await new Promise(r => setTimeout(r, 150))
    expect(cache!.get('k')).toBeUndefined()
  })
})
