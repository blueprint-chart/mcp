import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http'
import { randomUUID } from 'node:crypto'
import { createServer } from '../server.js'

export interface StartHttpOptions {
  port: number
  host?: string
  /** If set, require `Authorization: Bearer <token>` on every /mcp request. */
  authToken?: string
  /** Comma-resolved CORS allowlist. `'*'` allows any origin. Default: `'*'`. */
  allowedOrigins?: string[] | '*'
  /** Read `X-Forwarded-For` for client IP (enable when behind a reverse proxy). */
  trustProxy?: boolean
  /** Cap on concurrent `POST /mcp` requests. Default: 16. */
  maxConcurrentRequests?: number
  /** Per-IP token-bucket rate limit. Disabled when undefined or 0. */
  rateLimitPerMinute?: number
  /** Suppress JSON access logs. Default: false (logs to stderr). */
  silent?: boolean
  /** If set, redirect GET / to this URL. Otherwise returns 404. */
  rootRedirectUrl?: string
}

export interface HttpHandle {
  url: string
  close: () => Promise<void>
}

class Semaphore {
  private available: number
  private waiters: Array<() => void> = []

  constructor(max: number) {
    this.available = max
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1
      return () => this.release()
    }
    return new Promise<() => void>((resolve) => {
      this.waiters.push(() => {
        this.available -= 1
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.available += 1
    const next = this.waiters.shift()
    if (next) {
      next()
    }
  }
}

interface Bucket {
  tokens: number
  lastRefill: number
}

class TokenBucketLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(private readonly maxPerMinute: number) {}

  consume(key: string): boolean {
    const now = Date.now()
    const bucket = this.buckets.get(key) ?? { tokens: this.maxPerMinute, lastRefill: now }
    const elapsed = now - bucket.lastRefill
    if (elapsed > 0) {
      const refilled = (elapsed / 60_000) * this.maxPerMinute
      bucket.tokens = Math.min(this.maxPerMinute, bucket.tokens + refilled)
      bucket.lastRefill = now
    }
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket)
      return false
    }
    bucket.tokens -= 1
    this.buckets.set(key, bucket)
    return true
  }

  prune(): void {
    const cutoff = Date.now() - 5 * 60_000
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastRefill < cutoff) {
        this.buckets.delete(key)
      }
    }
  }
}

function getClientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0]!.trim()
    }
    if (Array.isArray(xff) && xff[0]) {
      return xff[0].split(',')[0]!.trim()
    }
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function applyCors(res: ServerResponse, origin: string | undefined, allowed: string[] | '*'): void {
  if (allowed === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Accept')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function logEvent(silent: boolean, fields: Record<string, unknown>): void {
  if (silent) {
    return
  }
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), ...fields })}\n`)
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function startHttp(opts: StartHttpOptions): Promise<HttpHandle> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })
  const server = createServer()
  await server.connect(transport)

  const allowedOrigins = opts.allowedOrigins ?? '*'
  const trustProxy = opts.trustProxy ?? false
  const silent = opts.silent ?? false
  const semaphore = new Semaphore(opts.maxConcurrentRequests ?? 16)
  const limiter = opts.rateLimitPerMinute && opts.rateLimitPerMinute > 0
    ? new TokenBucketLimiter(opts.rateLimitPerMinute)
    : undefined
  const pruneTimer = limiter ? setInterval(() => limiter.prune(), 60_000) : undefined
  if (pruneTimer && typeof pruneTimer.unref === 'function') {
    pruneTimer.unref()
  }

  const httpServer: HttpServer = createHttpServer(async (req, res) => {
    const started = Date.now()
    const origin = req.headers.origin
    const ip = getClientIp(req, trustProxy)
    applyCors(res, origin, allowedOrigins)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    // Health check (Railway / load-balancer liveness probe)
    if (req.url === '/healthz' || req.url === '/health') {
      jsonResponse(res, 200, { status: 'ok' })
      return
    }

    // Root redirect
    if (req.url === '/' && opts.rootRedirectUrl) {
      res.statusCode = 302
      res.setHeader('Location', opts.rootRedirectUrl)
      res.end()
      return
    }

    if (!req.url?.startsWith('/mcp')) {
      jsonResponse(res, 404, { error: 'Not Found' })
      return
    }

    // Bearer token auth (off if MCP_AUTH_TOKEN not set)
    if (opts.authToken) {
      const auth = req.headers.authorization
      if (auth !== `Bearer ${opts.authToken}`) {
        logEvent(silent, { event: 'auth_rejected', ip, method: req.method })
        jsonResponse(res, 401, { error: 'Unauthorized' })
        return
      }
    }

    // Per-IP rate limit
    if (limiter && !limiter.consume(ip)) {
      logEvent(silent, { event: 'rate_limited', ip })
      res.setHeader('Retry-After', '60')
      jsonResponse(res, 429, { error: 'Too Many Requests' })
      return
    }

    // Concurrency cap on POST (tool calls); GET streams unrestricted
    const cap = req.method === 'POST'
    const release = cap ? await semaphore.acquire() : undefined
    try {
      await transport.handleRequest(req, res)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logEvent(silent, { event: 'transport_error', ip, method: req.method, message })
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: 'Internal Server Error' })
      }
    }
    finally {
      release?.()
      logEvent(silent, {
        event: 'request',
        ip,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        durationMs: Date.now() - started,
      })
    }
  })

  await new Promise<void>(resolve => httpServer.listen(opts.port, opts.host ?? '127.0.0.1', resolve))
  const address = httpServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('http server has no port')
  }
  const url = `http://${opts.host ?? '127.0.0.1'}:${address.port}`

  return {
    url,
    close: async () => {
      if (pruneTimer) {
        clearInterval(pruneTimer)
      }
      await transport.close()
      httpServer.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        httpServer.close(err => (err ? reject(err) : resolve())),
      )
    },
  }
}
