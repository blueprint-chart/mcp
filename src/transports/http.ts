import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
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
  /** If set, require `Authorization: Bearer <token>` on every request. */
  authToken?: string
  /** Comma-resolved CORS allowlist. `'*'` allows any origin. Default: `'*'`. */
  allowedOrigins?: string[] | '*'
  /** Read `X-Forwarded-For` for client IP (enable when behind a reverse proxy). */
  trustProxy?: boolean
  /** Cap on concurrent tool calls. Default: 16. */
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version')
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
  const mcpServer = createServer()
  const sseSessions = new Map<string, SSEServerTransport>()

  const streamableTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })
  await mcpServer.connect(streamableTransport)

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
    const rawUrl = req.url ?? '/'
    const hostHeader = req.headers.host ?? 'unknown'
    const ip = getClientIp(req, trustProxy)
    const proto = trustProxy ? (req.headers['x-forwarded-proto'] as string ?? 'http') : 'http'

    // Raw log for every single request
    logEvent(silent, { event: 'raw_request', method: req.method, url: rawUrl, host: hostHeader, ip, proto })

    applyCors(res, req.headers.origin, allowedOrigins)

    // 1. Health check (Railway / load-balancer liveness probe)
    if (rawUrl === '/healthz' || rawUrl === '/health') {
      jsonResponse(res, 200, { status: 'ok' })
      return
    }

    // 2. Root redirect (highest priority after health check)
    if ((rawUrl === '/' || rawUrl === '') && opts.rootRedirectUrl) {
      logEvent(silent, { event: 'root_redirect', ip, to: opts.rootRedirectUrl })
      res.statusCode = 302
      res.setHeader('Location', opts.rootRedirectUrl)
      res.end()
      return
    }

    // 3. CORS preflight
    if (req.method === 'OPTIONS') {
      logEvent(silent, { event: 'preflight', ip, headers: req.headers })
      res.statusCode = 204
      res.end()
      return
    }

    const url = new URL(rawUrl, `${proto}://${hostHeader}`)
    const pathname = url.pathname
    const normalizedPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname

    if (normalizedPath !== '/mcp') {
      logEvent(silent, { event: 'path_not_found', path: pathname, ip, method: req.method })
      jsonResponse(res, 404, { error: 'Not Found' })
      return
    }

    logEvent(silent, { event: 'incoming_request', method: req.method, path: pathname, ip, headers: req.headers })

    // Bearer token auth (off if MCP_AUTH_TOKEN not set)
    if (opts.authToken) {
      const auth = req.headers.authorization
      if (auth !== `Bearer ${opts.authToken}`) {
        logEvent(silent, { event: 'auth_rejected', ip, method: req.method, headers: req.headers })
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

    try {
      if (req.method === 'GET') {
        // Distinguish between Streamable HTTP (w/ session header) and legacy SSE (w/o session header)
        if (req.headers['mcp-session-id']) {
          logEvent(silent, { event: 'streamable_get', ip, sessionId: req.headers['mcp-session-id'] })
          await streamableTransport.handleRequest(req, res)
        }
        else {
          const transport = new SSEServerTransport('/mcp', res)
          const sessionId = transport.sessionId
          sseSessions.set(sessionId, transport)
          transport.onclose = () => {
            logEvent(silent, { event: 'sse_closed', sessionId })
            sseSessions.delete(sessionId)
          }
          // Connect a fresh server instance per SSE session to avoid state contamination
          const sessionServer = createServer()
          await sessionServer.connect(transport)
          await transport.start() // Mandatory to start the stream!
          logEvent(silent, { event: 'sse_connected', ip, sessionId, headers: req.headers })
        }
      }
      else if (req.method === 'POST') {
        const sseSessionId = url.searchParams.get('sessionId')
        if (sseSessionId) {
          const transport = sseSessions.get(sseSessionId)
          if (!transport) {
            logEvent(silent, { event: 'sse_post_invalid_session', ip, sessionId: sseSessionId })
            jsonResponse(res, 400, { error: 'Invalid sessionId' })
            return
          }
          logEvent(silent, { event: 'sse_post', ip, sessionId: sseSessionId })
          const release = await semaphore.acquire()
          try {
            await transport.handlePostMessage(req, res)
          }
          finally {
            release()
          }
        }
        else {
          logEvent(silent, { event: 'streamable_post', ip })
          const release = await semaphore.acquire()
          try {
            await streamableTransport.handleRequest(req, res)
          }
          finally {
            release()
          }
        }
      }
      else {
        jsonResponse(res, 405, { error: 'Method Not Allowed' })
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      logEvent(silent, { event: 'transport_error', ip, method: req.method, message, stack })
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: 'Internal Server Error' })
      }
    }
    finally {
      logEvent(silent, {
        event: 'request_finished',
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
      await streamableTransport.close()
      for (const transport of sseSessions.values()) {
        await transport.close()
      }
      sseSessions.clear()
      httpServer.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        httpServer.close(err => (err ? reject(err) : resolve())),
      )
    },
  }
}
