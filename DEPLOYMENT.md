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
| `MCP_AUTH_TOKEN` | *(generate a 32+ char random secret)* | Require `Authorization: Bearer <token>` on every `/mcp` call. **Strongly recommended.** |
| `MCP_ALLOWED_ORIGINS` | `https://claude.ai,https://chatgpt.com` | Restrict CORS. Use `*` only if you need open access. |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60` | Per-IP rate limit. Start at 60; raise if customers complain. |
| `MCP_MAX_CONCURRENT_REQUESTS` | `16` | Cap on simultaneous POSTs. 16 is a safe default for a single 1 vCPU instance. Raise with the instance size. |
| `MCP_ROOT_REDIRECT_URL` | *(unset)* | If set, redirect `GET /` to this URL (e.g. your marketing site). |

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

Once `https://mcp.blueprintchart.com` is live:

**Claude.ai (web) — Pro/Team/Enterprise tiers:**
1. Settings → Connectors → **Add custom integration**.
2. URL: `https://mcp.blueprintchart.com/mcp`
3. Auth header (if `MCP_AUTH_TOKEN` set): `Authorization: Bearer <token>`

**Claude Code (CLI):**
```bash
claude mcp add blueprint-chart --transport http https://mcp.blueprintchart.com/mcp \
  --header "Authorization: Bearer <token>"
```

**Cursor:** Settings → MCP → Add server → URL + bearer token.

## Local Docker testing

To validate the Docker image before pushing:

```bash
docker build -t blueprint-chart-mcp .
docker run --rm -p 4321:4321 \
  -e MCP_AUTH_TOKEN=test-token \
  -e MCP_TRUST_PROXY=0 \
  blueprint-chart-mcp

# In another terminal
curl http://127.0.0.1:4321/healthz                                    # → {"status":"ok"}
curl -X POST http://127.0.0.1:4321/mcp \
  -H 'Authorization: Bearer test-token' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Operational reference

### Environment variables (full list)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4321` | HTTP port. Railway sets this. |
| `MCP_HTTP` | `0` | `1` to default to HTTP mode (equivalent to `--http`). |
| `MCP_HOST` | `127.0.0.1` | Bind host. Set to `0.0.0.0` in containers. |
| `MCP_AUTH_TOKEN` | *(unset)* | If set, require `Authorization: Bearer <token>`. |
| `MCP_ALLOWED_ORIGINS` | `*` | Comma-separated CORS allowlist. Use specific origins in prod. |
| `MCP_TRUST_PROXY` | `0` | `1` to read `X-Forwarded-For`. Set behind Railway/Cloudflare/Caddy. |
| `MCP_MAX_CONCURRENT_REQUESTS` | `16` | Cap on concurrent POST /mcp requests. |
| `MCP_RATE_LIMIT_PER_MINUTE` | *(off)* | Per-IP rate limit. Recommend `60` in prod. |
| `MCP_SILENT` | `0` | `1` to suppress JSON access logs to stderr. |
| `MCP_ROOT_REDIRECT_URL` | *(unset)* | If set, redirect `GET /` to this URL. |

### Endpoints

| Path | Method | Purpose |
| --- | --- | --- |
| `/healthz` (alias `/health`) | GET | Liveness probe. Returns `{status:"ok"}`. |
| `/mcp` | POST | MCP JSON-RPC. Requires auth if `MCP_AUTH_TOKEN` is set. |
| `/mcp` | GET | MCP SSE stream (long-lived). |
| `/mcp` | OPTIONS | CORS preflight. |

### Logs

Production logs are JSON-per-line to **stderr** (Railway captures stderr by default). Each request emits a `{event:"request", ip, method, path, status, durationMs}` line. Auth rejections and rate-limit hits emit `{event:"auth_rejected"}` / `{event:"rate_limited"}`. Set `MCP_SILENT=1` to disable.

### Failure modes and recovery

| Symptom | Cause | Fix |
| --- | --- | --- |
| Railway health check failing during deploy | `/healthz` not responding before `start-period` expires | Bump `healthcheckTimeout` in `railway.json`. Default 30s; raise to 60s if cold start is slow. |
| `401 Unauthorized` from Claude after setup | `MCP_AUTH_TOKEN` set but Claude integration missing the header | Re-enter the bearer token in the Custom Integration dialog. |
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
