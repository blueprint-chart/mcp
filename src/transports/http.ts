import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', '..', 'public')

interface StaticAsset {
  file: string
  contentType: string
}

// Routes served from `public/`. `/favicon.ico` is mapped to the PNG file: modern
// browsers identify image format by magic bytes, and shipping a real multi-size
// ICO would add a build-time generator for no real benefit here.
const STATIC_ROUTES: Record<string, StaticAsset> = {
  '/favicon.ico': { file: 'favicon.png', contentType: 'image/png' },
  '/favicon.png': { file: 'favicon.png', contentType: 'image/png' },
  '/favicon.svg': { file: 'favicon.svg', contentType: 'image/svg+xml' },
  '/apple-touch-icon.png': { file: 'apple-touch-icon.png', contentType: 'image/png' },
}

async function loadStaticAssets(): Promise<Map<string, { body: Buffer, contentType: string }>> {
  const cache = new Map<string, { body: Buffer, contentType: string }>()
  for (const [route, asset] of Object.entries(STATIC_ROUTES)) {
    try {
      const body = await readFile(join(PUBLIC_DIR, asset.file))
      cache.set(route, { body, contentType: asset.contentType })
    }
    catch {
      // Asset missing → route stays unregistered; request will 404 as before.
    }
  }
  return cache
}

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

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return undefined
  }
  try {
    return JSON.parse(raw)
  }
  catch {
    return undefined
  }
}

export async function startHttp(opts: StartHttpOptions): Promise<HttpHandle> {
  const sseSessions = new Map<string, SSEServerTransport>()
  const streamableSessions = new Map<string, StreamableHTTPServerTransport>()
  const staticAssets = await loadStaticAssets()

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

    // 4. Static assets (favicon, etc.) — served unauthenticated so browsers can
    //    fetch them even when MCP_AUTH_TOKEN is set on the `/mcp` route.
    if (req.method === 'GET' && staticAssets.has(normalizedPath)) {
      const asset = staticAssets.get(normalizedPath)!
      res.statusCode = 200
      res.setHeader('Content-Type', asset.contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.end(asset.body)
      return
    }

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
      const streamableSessionHeader = req.headers['mcp-session-id']
      const streamableSessionId = Array.isArray(streamableSessionHeader)
        ? streamableSessionHeader[0]
        : streamableSessionHeader

      if (req.method === 'GET') {
        // Streamable HTTP GETs always include the Mcp-Session-Id header — they're
        // a server→client SSE notification stream for an established session.
        // Legacy SSE GETs are the bootstrap and have no session header.
        if (streamableSessionId) {
          const transport = streamableSessions.get(streamableSessionId)
          if (!transport) {
            logEvent(silent, { event: 'streamable_get_invalid_session', ip, sessionId: streamableSessionId })
            jsonResponse(res, 404, { error: 'Unknown session' })
            return
          }
          logEvent(silent, { event: 'streamable_get', ip, sessionId: streamableSessionId })
          await transport.handleRequest(req, res)
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
      else if (req.method === 'DELETE') {
        // Streamable HTTP session termination — client signals it's done with the session.
        if (streamableSessionId) {
          const transport = streamableSessions.get(streamableSessionId)
          if (transport) {
            logEvent(silent, { event: 'streamable_delete', ip, sessionId: streamableSessionId })
            await transport.handleRequest(req, res)
          }
          else {
            jsonResponse(res, 404, { error: 'Unknown session' })
          }
        }
        else {
          jsonResponse(res, 400, { error: 'Mcp-Session-Id header required for DELETE' })
        }
      }
      else if (req.method === 'POST') {
        const sseSessionId = url.searchParams.get('sessionId')
        if (sseSessionId) {
          // Legacy SSE POST: messages flow over the open SSE stream identified by sessionId query param.
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
          // Streamable HTTP POST: either an initialize bootstrap (no Mcp-Session-Id yet)
          // or a follow-up request on an existing session (Mcp-Session-Id in headers).
          const body = await readRequestBody(req)
          const release = await semaphore.acquire()
          try {
            if (streamableSessionId) {
              const transport = streamableSessions.get(streamableSessionId)
              if (!transport) {
                logEvent(silent, { event: 'streamable_post_invalid_session', ip, sessionId: streamableSessionId })
                jsonResponse(res, 404, { error: 'Unknown session' })
                return
              }
              logEvent(silent, { event: 'streamable_post', ip, sessionId: streamableSessionId })
              await transport.handleRequest(req, res, body)
            }
            else if (isInitializeRequest(body)) {
              // Per-session transport: each initialize starts a fresh session with its own
              // server instance. The SDK assigns the session ID and we register the transport
              // in the map via onsessioninitialized so subsequent POST/GET/DELETE can find it.
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sid) => {
                  streamableSessions.set(sid, transport)
                  logEvent(silent, { event: 'streamable_session_initialized', sessionId: sid })
                },
              })
              transport.onclose = () => {
                if (transport.sessionId) {
                  streamableSessions.delete(transport.sessionId)
                  logEvent(silent, { event: 'streamable_session_closed', sessionId: transport.sessionId })
                }
              }
              const sessionServer = createServer()
              await sessionServer.connect(transport)
              logEvent(silent, { event: 'streamable_init', ip })
              await transport.handleRequest(req, res, body)
            }
            else {
              jsonResponse(res, 400, {
                jsonrpc: '2.0',
                error: { code: -32600, message: 'Invalid Request: missing Mcp-Session-Id and not an initialize request' },
                id: null,
              })
            }
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
      for (const transport of streamableSessions.values()) {
        await transport.close()
      }
      streamableSessions.clear()
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
