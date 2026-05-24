# @blueprint-chart/mcp — Coding Guidelines

## General

- TypeScript everywhere, strict mode.
- Small, iterative, semantic commits — no co-author or body. Conventional types only: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`.
- Makefile targets are the canonical way to run operations (`make install`, `make dev`, `make test`, `make lint`, `make build`).
- Code quality and readability are central — keep tools, resources, and render modules small and single-purpose.
- This package follows the same conventions as [`blueprint-chart`](../blueprint-chart/AGENTS.md). Where this file is silent, defer to that one.

## Project Structure

Single-package npm project (`@blueprint-chart/mcp`) — no workspace, no Vue, no SCSS.

```
src/
  server.ts                  # Transport-agnostic MCP Server; wires tools, resources, prompts
  cli.ts                     # CLI entry: stdio default, --http for hosted; reads env vars
  parse.ts                   # parseDsl: wraps @blueprint-chart/lib's Peggy parser with ToolResult
  errors.ts                  # ErrorCode enum + ToolResult<T> shape
  tools/                     # Tool handlers: validate, inspect, recommend, render
  resources/                 # Resource handlers: docs-backed + samples-backed
  prompts/                   # Prompt templates (author_chart)
  render/                    # Headless render pipeline (jsdom + textShim + resvg)
  transports/                # stdio + StreamableHTTP entries; share `createServer()`
  lib/                       # Internal helpers (e.g. zod→JSON Schema stub)
bin/
  blueprint-chart-mcp.js     # CLI launcher
  loader.mjs                 # ESM resolver hook (resolves extensionless imports)
test/
  integration/               # In-memory MCP transport tests, transport-parity
  golden/                    # Render snapshot suite over @blueprint-chart/lib samples
docs/superpowers/            # Local-only spec/plan artifacts (gitignored)
```

## Dependencies

Pinned npm packages (no workspace deps):

- `@blueprint-chart/lib` — DSL parser, `renderBpc`, `recommendCharts`, samples
- `@blueprint-chart/docs` — handbook + guide + chart-types + reference markdown
- `@modelcontextprotocol/sdk` — MCP Server, transports, types

Render-pipeline natives:

- `jsdom` — headless DOM
- `@napi-rs/canvas` — text measurement shim for D3 layout
- `@resvg/resvg-js` — SVG → PNG rasterizer

## TypeScript

- Strict mode, `noUncheckedIndexedAccess: true`. Guard array access or use `!` with intent.
- ESM only (`"type": "module"`). `import` only, no `require`.
- `moduleResolution: "Bundler"` — TS emits extensionless relative imports; `bin/loader.mjs` resolves them at runtime.
- Public types live next to their consumer. Per-module `interface` declarations preferred over a `types.ts` dumping ground.
- Use `import type { … }` for type-only imports.

## Tools / Resources / Prompts pattern

- **Tool handlers** take a single typed input, return `ToolResult<T>`. Never throw to the transport.
- **Validate inputs with zod** at the boundary. Map zod errors to `E_INPUT`.
- **Reuse `parseDsl`** for any tool that needs to parse a `.bpc` source. Don't re-implement parser-error mapping.
- **Resources** are stateless and deterministic. A URI maps to a single static document for a given MCP version.
- **Prompts** are templates referencing resource URIs by handle. Don't embed full grammar text in prompts — point to `bpc://grammar`.

## Error handling

Every tool returns `ToolResult<T>` from `src/errors.ts`:

```ts
type ToolResult<T> =
  | { ok: true;  data: T }
  | { ok: false; code: ErrorCode; errors: ToolErrorEntry[] }
```

Error codes:

| Code | When |
| --- | --- |
| `E_INPUT` | Tool input fails schema validation |
| `E_PARSE` | Peggy syntax error in `source` |
| `E_SEMANTIC` | Parsed OK but references unknown chart type, scene OOB, etc. |
| `E_RENDER` | jsdom or resvg failure (preserve any SVG produced before the failure) |
| `E_INTERNAL` | Anything unexpected |

`render` preserves the SVG even when PNG rasterization fails — partial-success on `format: 'png'` returns `{ok: false, code: E_RENDER}` with `data` containing the SVG.

## Testing

- **Vitest** for unit + integration. Co-located: `foo.ts` → `foo.test.ts`.
- **In-memory MCP transport** (`InMemoryTransport.createLinkedPair`) for protocol tests in `src/server.test.ts`. Each new tool/resource/prompt gets a server-level test.
- **Transport-parity test** (`test/integration/transport-parity.test.ts`) asserts in-memory and HTTP return identical payloads.
- **Golden snapshots** (`test/golden/`) over six canonical samples from `@blueprint-chart/lib`. Normalize transient bits (d3-random ids, `url(#…)` refs) before snapshot compare. Update with `pnpm vitest run test/golden -u`.
- **No live LLM in CI** — test against the MCP protocol, not the client.
- All tests must pass before commit. `make lint && make test && make build` is the pre-push checklist.

## HTTP transport (production)

Production deployment is documented in [`DEPLOYMENT.md`](./DEPLOYMENT.md). The transport supports:

- Bearer-token auth (`MCP_AUTH_TOKEN`)
- CORS allowlist (`MCP_ALLOWED_ORIGINS`)
- Per-IP token-bucket rate limit (`MCP_RATE_LIMIT_PER_MINUTE`)
- Concurrency cap on `POST /mcp` (`MCP_MAX_CONCURRENT_REQUESTS`)
- `X-Forwarded-For` parsing (`MCP_TRUST_PROXY`)
- `/healthz` for liveness probes
- Structured JSON access logs to stderr (`MCP_SILENT=1` to disable)

Add new transport features behind opt-in env vars. Defaults stay safe for local stdio.

## Linting

- ESLint flat config with `@eslint/js`, `typescript-eslint`, `@stylistic/eslint-plugin` (same set as the lib repo).
- `curly: 'all'`, `@stylistic/comma-dangle: always-multiline`, no single-line `if (x) { ... }` (split to multi-line braces).
- Run `make lint` before committing; `make lint-fix` to auto-fix what it can.

## Release

See [`RELEASING.md`](./RELEASING.md). Use `make release-patch` / `make release VERSION=x.y.z`. Never edit `package.json` `version` manually.

## Spec / plan artifacts

`docs/superpowers/` is gitignored. Specs and plans live locally only — do not commit even when a skill says to.

## What this repo does *not* contain

- No Vue, no SCSS, no Bootstrap — those are blueprint-chart concerns.
- No browser bundle — single Node.js process.
- No Playwright e2e — `test/integration/` covers the protocol contract end-to-end via real transports.
