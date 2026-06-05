# Deployment

`@blueprint-chart/mcp` runs anywhere a single Node 24 container can run. The reference deployment is on [Railway](https://railway.app/) at `mcp.blueprintchart.com`.

## Railway setup

### 1. Create the service

1. **New Project → Deploy from GitHub repo** → pick `blueprint-chart/mcp`.
2. Railway auto-detects the `Dockerfile`. Confirm — the **Builder** in Settings should read `DOCKERFILE` (see `railway.json`).
3. Wait for the first build to finish.

### 2. Configure environment variables

In **Variables**, set:

| Variable | Value | Why |
| --- | --- | --- |
| `MCP_HTTP` | `1` | Run in HTTP mode. (Already baked into the Dockerfile, but explicit is fine.) |
| `MCP_HOST` | `0.0.0.0` | Bind to all interfaces. (Already baked in.) |
| `MCP_TRUST_PROXY` | `1` | Read `X-Forwarded-For` for client IPs. **Required** behind Railway's proxy. |
| `MCP_AUTH_TOKEN` | *(unset)* | Leave unset for the default public deployment. See [Authentication](#authentication) below if you ever want to restrict access. |
| `MCP_ALLOWED_ORIGINS` | `*` | CORS allowlist. `*` is fine for a public deployment; tighten to specific origins if you go private. |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60` | Per-IP rate limit. Critical when the endpoint is public — start at 60; raise if real users complain. |
| `MCP_MAX_CONCURRENT_REQUESTS` | `16` | Cap on simultaneous POSTs. 16 is a safe default for a single 1 vCPU instance. Raise with the instance size. |
| `MCP_ROOT_REDIRECT_URL` | *(unset)* | If set, redirect `GET /` to this URL (e.g. your marketing site). |
| `MCP_PUBLIC_URL` | `https://mcp.blueprintchart.com` | Public base URL (no path, no trailing slash). When set, the server advertises `serverInfo.icons` with absolute URLs so MCP clients (claude.ai, ChatGPT) can render the favicon next to the connector. Leave unset for stdio / local use. |
| `BLUEPRINT_CHART_EDITOR_URL` | `https://blueprintchart.com` | Editor app base URL (no trailing slash). Required for `export_chart` to mint shareable copy/embed links. Unset disables export. |
| `BLUEPRINT_CHART_DOCS_URL` | `https://docs.blueprintchart.com` | Docs site base URL. When set, tools/resources include `docsUrl` fields linking out to reference pages. |

`PORT` is set automatically by Railway — don't override it.

### 3. Custom domain

1. **Settings → Networking → Custom Domain** → `mcp.blueprintchart.com`.
2. Add the CNAME record Railway shows you to your DNS provider.
3. Railway provisions TLS automatically once DNS resolves.

### 4. Health checks

`railway.json` already declares `/healthz` as the health check path. The Dockerfile also includes a `HEALTHCHECK` directive for non-Railway hosts. Both probe `GET /healthz` and expect `200 {"status":"ok"}`.

### 5. Scaling

Railway scales horizontally. For higher throughput:

- Bump the instance size (vCPU + memory) in **Settings → Resources**.
- Add replicas (if your plan supports it).
- Adjust `MCP_MAX_CONCURRENT_REQUESTS` to match — roughly `4 × vCPU` is a sane upper bound for the render-heavy workload.

The rate limiter and concurrency cap are **per-instance** (in-memory). If you run multiple replicas, total capacity is replicas × `MCP_RATE_LIMIT_PER_MINUTE` per IP. For coordinated limiting across replicas, front the service with Cloudflare or a managed gateway.

## Connecting Claude / ChatGPT / Cursor

Once `https://mcp.blueprintchart.com` is live the endpoint is open — no token required.

**Claude.ai (web) — Pro/Team/Enterprise tiers:**
1. Settings → Connectors → **Add custom integration**.
2. URL: `https://mcp.blueprintchart.com`
3. Save. No auth header to enter.

**Claude Code (CLI):**
```bash
claude mcp add blueprint-chart --transport http https://mcp.blueprintchart.com
```

**Cursor:** Settings → MCP → Add server → URL.

**ChatGPT (Custom Connectors):** Add the URL as a custom connector. No auth.

## Authentication

The reference deployment runs **without authentication**. If you fork the project for a private or internal deployment, set `MCP_AUTH_TOKEN` to a 32+ char random secret. The server then requires `Authorization: Bearer <token>` on every MCP call (see `src/transports/http.ts`).

Caveat: `MCP_AUTH_TOKEN` is a static shared secret. It works with clients that let you configure a custom header (Claude Code CLI, Cursor, VS Code MCP, server-to-server scripts) but **not** with Claude.ai's web connector dialog or ChatGPT's custom connectors — those clients speak OAuth 2.1 and have no field to paste a bearer token. If you need web-client access *and* authentication, you have to implement OAuth on the server — this repo does not.

## Local Docker testing

To validate the Docker image before pushing:

```bash
docker build -t blueprint-chart-mcp .
docker run --rm -p 4321:4321 \
  -e MCP_TRUST_PROXY=0 \
  blueprint-chart-mcp

# In another terminal
curl http://127.0.0.1:4321/healthz                                    # → {"status":"ok"}
curl -X POST http://127.0.0.1:4321/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

To test the auth gate locally, add `-e MCP_AUTH_TOKEN=test-token` to `docker run` and `-H 'Authorization: Bearer test-token'` to the `curl` call.

## Operational reference

### Environment variables (full list)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4321` | HTTP port. Railway sets this. |
| `MCP_HTTP` | `0` | `1` to default to HTTP mode (equivalent to `--http`). |
| `MCP_HOST` | `127.0.0.1` | Bind host. Set to `0.0.0.0` in containers. |
| `MCP_AUTH_TOKEN` | *(unset)* | If set, require `Authorization: Bearer <token>` on every MCP call. See [Authentication](#authentication). Left unset in the reference deployment. |
| `MCP_ALLOWED_ORIGINS` | `*` | Comma-separated CORS allowlist. `*` is fine for a public deployment; tighten if you go private. |
| `MCP_TRUST_PROXY` | `0` | `1` to read `X-Forwarded-For`. Set behind Railway/Cloudflare/Caddy. |
| `MCP_MAX_CONCURRENT_REQUESTS` | `16` | Cap on concurrent MCP POST requests. |
| `MCP_RATE_LIMIT_PER_MINUTE` | *(off)* | Per-IP rate limit. Recommend `60` in prod. |
| `MCP_SILENT` | `0` | `1` to suppress JSON access logs to stderr. |
| `MCP_ROOT_REDIRECT_URL` | *(unset)* | If set, redirect `GET /` to this URL. |
| `MCP_PUBLIC_URL` | *(unset)* | Public base URL (no path, no trailing slash). When set, advertised in `serverInfo.icons` so MCP clients can render the favicon. Required for icons to show in claude.ai / ChatGPT. |
| `BLUEPRINT_CHART_EDITOR_URL` | *(unset)* | Editor app base URL (no trailing slash). When set, the `export_chart` tool mints shareable copy/embed links pointing at this base. Unset disables export (`export_chart` returns `E_CONFIG`). Recommended: `https://blueprintchart.com`. |
| `BLUEPRINT_CHART_DOCS_URL` | *(unset)* | Docs site base URL. When set, tools and resource listings include a public `docsUrl` field so clients can link out to reference pages. Unset omits the field. Recommended: `https://docs.blueprintchart.com`. |
| `MCP_RENDER_RATE_LIMIT_PER_MINUTE` | `30` | Per-IP rate limit for the render endpoints (`/render.png`, `/render.svg`, `/render.bpc`). `0` disables. Empty = default. |
| `MCP_RENDER_CACHE_MAX_BYTES` | `52428800` | Maximum in-memory cache size for rendered outputs (50 MB). `0` disables the cache. Empty = default. |
| `MCP_RENDER_CACHE_TTL_SECONDS` | `3600` | TTL for cached render results in seconds (1 hour). Empty = default. |

### Endpoints

| Path | Method | Purpose |
| --- | --- | --- |
| `/healthz` (alias `/health`) | GET | Liveness probe. Returns `{status:"ok"}`. |
| `/` | POST | MCP JSON-RPC. Requires auth if `MCP_AUTH_TOKEN` is set. |
| `/` | GET (with `Accept: text/event-stream` or `Mcp-Session-Id`) | MCP SSE stream (long-lived). |
| `/` | GET (plain browser) | Redirects to `MCP_ROOT_REDIRECT_URL` if set; otherwise 404. |
| `/` | DELETE | Streamable HTTP session teardown (requires `Mcp-Session-Id`). |
| `/` | OPTIONS | CORS preflight. |
| `/favicon.ico`, `/favicon.png`, `/favicon.svg`, `/apple-touch-icon.png` | GET | Brand assets from `public/`. Always public, even when `MCP_AUTH_TOKEN` is set. |
| `/render.png` | GET | Render a `.bpc` source to PNG. See [Render endpoints](#render-endpoints). |
| `/render.svg` | GET | Render a `.bpc` source to SVG. See [Render endpoints](#render-endpoints). |
| `/render.bpc` | GET | Return the raw `.bpc` source ("view source" for any chart URL). See [Render endpoints](#render-endpoints). |

### Render endpoints

Three stateless GET routes turn a `.bpc` source into a rendered image or the chart source itself. The chart data travels inside the URL — no session, no server state.

| Route | Query params | Description |
| --- | --- | --- |
| `/render.png` | `bpc64`, `scene`, `width`, `height` | Rasterize to PNG at 2× (retina). |
| `/render.svg` | `bpc64`, `scene`, `width`, `height` | Return the SVG render. |
| `/render.bpc` | `bpc64` | Decode and return the raw `.bpc` source (`text/plain`). |

**Query parameters:**

- `bpc64` *(required)* — URL-safe base64 of the `.bpc` source (base64url, no padding required).
- `scene` — zero-based scene index. Defaults to `0`.
- `width` / `height` — output dimensions in pixels, capped at `1600` each.

**curl example:**

```bash
BPC64=$(printf 'chart bar-vertical { title = "Test"\n data { "A" = 1 } }' \
  | base64 -w0 | tr '+/' '-_' | tr -d '=')
curl "https://mcp.blueprintchart.com/render.png?bpc64=${BPC64}&width=800&height=500" \
  --output chart.png
```

**Embed as an `<img>` tag:**

```html
<img src="https://mcp.blueprintchart.com/render.png?bpc64=<bpc64value>&width=800&height=400"
     alt="Blueprint Chart" width="800" height="400">
```

Responses carry `Cache-Control: public, max-age=31536000, immutable` and version-aware ETags (both the `@blueprint-chart/lib` version and content hash contribute to the ETag). A `304 Not Modified` is returned when the client's `If-None-Match` matches. This means a CDN (e.g. Cloudflare) placed in front is a zero-code DNS change — set `MCP_TRUST_PROXY=1` behind one, and revisit the per-IP rate-limit key (see `TODOS.md`).

**Rate limiting:** render endpoints use a separate `MCP_RENDER_RATE_LIMIT_PER_MINUTE` limit (default `30`; `0` disables). Requests over the limit receive `429 Too Many Requests`.

**Request-body size:** `bpc64` values encoding more than 8 KB of source are rejected with `413 Content Too Large`.

**Caching:** rendered outputs are cached in an LRU memory cache keyed on the full URL. Tune with `MCP_RENDER_CACHE_MAX_BYTES` (default 50 MB; `0` disables) and `MCP_RENDER_CACHE_TTL_SECONDS` (default 3600; `0` disables TTL expiry). Empty values for either variable fall back to the default.

> **Deployment rule:** never set `MCP_PUBLIC_URL` on a deployment whose build predates the render endpoints — tool responses would advertise `urls` that 404.

### Logs

Production logs are JSON-per-line to **stderr** (Railway captures stderr by default). Each request emits a `{event:"request", ip, method, path, status, durationMs}` line. Auth rejections and rate-limit hits emit `{event:"auth_rejected"}` / `{event:"rate_limited"}`. Set `MCP_SILENT=1` to disable.

### Failure modes and recovery

| Symptom | Cause | Fix |
| --- | --- | --- |
| Railway health check failing during deploy | `/healthz` not responding before `start-period` expires | Bump `healthcheckTimeout` in `railway.json`. Default 30s; raise to 60s if cold start is slow. |
| `401 Unauthorized` from Claude after setup | `MCP_AUTH_TOKEN` set on the server, but the client isn't sending a matching `Authorization: Bearer …` header | Either unset `MCP_AUTH_TOKEN` (public deployment), or re-add the connector from a client that supports custom headers (Claude Code CLI, Cursor). Claude.ai web and ChatGPT cannot send static bearer tokens — see [Authentication](#authentication). |
| `429 Too Many Requests` for a real user | `MCP_RATE_LIMIT_PER_MINUTE` too low for the workflow | Bump the env var; Railway re-deploys (or no restart needed — it reads env on boot, so a manual restart applies it). |
| All requests hang after ~16 simultaneous calls | Concurrency cap reached, semaphore queueing | Raise `MCP_MAX_CONCURRENT_REQUESTS` and/or instance size. |
| `getBBox` / text layout looks wrong | Font missing in container | The Dockerfile installs `fonts-dejavu-core` + `fontconfig`. If you need additional fonts (CJK, etc.), add them to the `apt-get install` line. |
| Render returns SVG but no PNG with `E_RENDER` | resvg couldn't rasterize (often a malformed SVG or missing font) | Check the JSON log line for the `path: "rasterize"` error. The SVG is still in the response. |

### Updating the deployment

Push to `main` → Railway auto-deploys. Set up branch protection so only reviewed commits land on `main`.

For a controlled release:
1. `make release-patch` locally
2. `git push --follow-tags`
3. Create a GitHub Release for the new tag
4. The `Release` workflow publishes to npm; Railway redeploys from `main`

If you want Railway to deploy only on tags, set the **Deployment Trigger** to a custom branch and merge to it on release.
