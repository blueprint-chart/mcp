import { startStdio } from './transports/stdio.js'
import { startHttp, type HttpHandle, type StartHttpOptions } from './transports/http.js'

interface CliConfig {
  http: boolean
  port: number
  host: string
  httpOpts: StartHttpOptions
}

function parseBool(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  return value === '1' || value.toLowerCase() === 'true'
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

function parseConfig(argv: string[]): CliConfig {
  const env = process.env
  const port = Number(env.PORT) || 4321
  const host = env.MCP_HOST || (env.PORT ? '0.0.0.0' : '127.0.0.1')
  const allowedOriginsList = parseList(env.MCP_ALLOWED_ORIGINS)
  const allowedOrigins: string[] | '*' | undefined = allowedOriginsList
    && allowedOriginsList.length === 1 && allowedOriginsList[0] === '*'
    ? '*'
    : allowedOriginsList

  const config: CliConfig = {
    http: parseBool(env.MCP_HTTP),
    port,
    host,
    httpOpts: {
      port,
      host,
      authToken: env.MCP_AUTH_TOKEN || undefined,
      allowedOrigins,
      trustProxy: parseBool(env.MCP_TRUST_PROXY),
      maxConcurrentRequests: env.MCP_MAX_CONCURRENT_REQUESTS
        ? Number(env.MCP_MAX_CONCURRENT_REQUESTS)
        : undefined,
      rateLimitPerMinute: env.MCP_RATE_LIMIT_PER_MINUTE
        ? Number(env.MCP_RATE_LIMIT_PER_MINUTE)
        : undefined,
      silent: parseBool(env.MCP_SILENT),
      rootRedirectUrl: env.MCP_ROOT_REDIRECT_URL || undefined,
    },
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--http') {
      config.http = true
    }
    else if (a === '--stdio') {
      config.http = false
    }
    else if (a === '--port' && argv[i + 1]) {
      const p = Number(argv[++i])
      config.port = p
      config.httpOpts.port = p
    }
    else if (a === '--host' && argv[i + 1]) {
      const next = argv[++i]
      if (next) {
        config.host = next
        config.httpOpts.host = next
      }
    }
    else if (a === '--help' || a === '-h') {
      process.stderr.write(`Usage: blueprint-chart-mcp [--http|--stdio] [--port N] [--host HOST]

Stdio mode (default): for Claude Desktop, Claude Code, Cursor, etc.
HTTP mode (--http): for hosted use (e.g. Railway, behind a reverse proxy).

Environment variables (HTTP mode):
  PORT                          HTTP port (default 4321). Railway sets this.
  MCP_HTTP=1                    Default to HTTP mode (same as --http).
  MCP_HOST                      Bind host (default 127.0.0.1; use 0.0.0.0 in containers).
  MCP_AUTH_TOKEN                If set, require Authorization: Bearer <token>.
  MCP_ALLOWED_ORIGINS           Comma-separated CORS allowlist, or "*" (default).
  MCP_TRUST_PROXY=1             Read X-Forwarded-For (enable behind a proxy / Railway).
  MCP_MAX_CONCURRENT_REQUESTS   Cap on concurrent POSTs (default 16).
  MCP_RATE_LIMIT_PER_MINUTE     Per-IP rate limit (default off; e.g. 60).
  MCP_SILENT=1                  Suppress JSON access logs to stderr.
  MCP_ROOT_REDIRECT_URL         If set, redirect GET / to this URL.
  MCP_PUBLIC_URL                Public base URL (no path, no trailing slash).
                                When set, advertised in serverInfo.icons so
                                MCP clients (claude.ai, etc.) can render the
                                favicon. Example: https://mcp.example.com
`)
      process.exit(0)
    }
  }

  return config
}

function installSignalHandlers(close: () => Promise<void>): void {
  let shuttingDown = false
  const handler = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    close()
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        process.stderr.write(`Error during shutdown (${signal}): ${message}\n`)
      })
      .finally(() => {
        process.exit(0)
      })
  }
  process.on('SIGINT', handler)
  process.on('SIGTERM', handler)
}

const config = parseConfig(process.argv.slice(2))

if (config.http) {
  startHttp(config.httpOpts)
    .then((handle: HttpHandle) => {
      process.stderr.write(`MCP HTTP server listening at ${handle.url}/mcp\n`)
      installSignalHandlers(handle.close)
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Failed to start HTTP: ${message}\n`)
      process.exit(1)
    })
}
else {
  startStdio().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Failed to start stdio: ${message}\n`)
    process.exit(1)
  })
}
