import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createServer } from '../server'

export interface StartHttpOptions {
  port: number
  host?: string
}

export interface HttpHandle {
  url: string
  close: () => Promise<void>
}

export async function startHttp(opts: StartHttpOptions): Promise<HttpHandle> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })
  const server = createServer()
  await server.connect(transport)

  const httpServer: HttpServer = createHttpServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      res.statusCode = 404
      res.end('Not Found')
      return
    }
    await transport.handleRequest(req, res)
  })

  await new Promise<void>(resolve => httpServer.listen(opts.port, opts.host ?? '127.0.0.1', resolve))
  const address = httpServer.address()
  if (!address || typeof address === 'string') throw new Error('http server has no port')
  const url = `http://${opts.host ?? '127.0.0.1'}:${address.port}`

  return {
    url,
    close: async () => {
      await new Promise<void>((r, rej) => httpServer.close(err => (err ? rej(err) : r())))
      await transport.close()
    },
  }
}
