import { startStdio } from './transports/stdio.js'
import { startHttp, type HttpHandle } from './transports/http.js'

interface CliArgs {
  http: boolean
  port: number
  host: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { http: false, port: 4321, host: '127.0.0.1' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--http') {
      args.http = true
    }
    else if (a === '--port' && argv[i + 1]) {
      args.port = Number(argv[++i])
    }
    else if (a === '--host' && argv[i + 1]) {
      const next = argv[++i]
      if (next) args.host = next
    }
    else if (a === '--help' || a === '-h') {
      process.stderr.write('Usage: blueprint-chart-mcp [--http] [--port N] [--host HOST]\n')
      process.exit(0)
    }
  }
  return args
}

function installSignalHandlers(close: () => Promise<void>): void {
  let shuttingDown = false
  const handler = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return
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

const args = parseArgs(process.argv.slice(2))

if (args.http) {
  startHttp({ port: args.port, host: args.host })
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
