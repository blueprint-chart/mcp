import { LRUCache } from 'lru-cache'

export interface RenderCacheEntry {
  body: Buffer
  contentType: string
}

export type RenderCache = LRUCache<string, RenderCacheEntry>

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024
const DEFAULT_TTL_SECONDS = 3600

/**
 * In-memory cache for the HTTP /render.* endpoints (eng review D5: lru-cache,
 * not hand-rolled — byte budgets and TTL are native). Pure optimization: keys
 * are immutable (version-aware ETags), so a wipe just means re-rendering.
 * Returns undefined when disabled via MCP_RENDER_CACHE_MAX_BYTES=0.
 */
export function createRenderCache(): RenderCache | undefined {
  const maxSize = Number(process.env.MCP_RENDER_CACHE_MAX_BYTES?.trim() || DEFAULT_MAX_BYTES)
  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    return undefined
  }
  const ttlSeconds = Number(process.env.MCP_RENDER_CACHE_TTL_SECONDS?.trim() || DEFAULT_TTL_SECONDS)
  return new LRUCache<string, RenderCacheEntry>({
    maxSize,
    // +64 approximates per-entry key/metadata overhead
    sizeCalculation: entry => entry.body.byteLength + 64,
    ttl: (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS) * 1000,
  })
}
