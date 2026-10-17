# 0010: Playtest hosting on Railway (primary) + LiveKit Cloud (voice)

Status: direction from Human, 2026-10-17. Railway is the current host; Render (0009) is the documented alternative; LiveKit Cloud is the voice provider. One host at a time: no simultaneous deployments, no multi-cloud. Paper and repo config only: no sign-ups, spend, credentials or deploys.
Facts are from Railway's primary docs (docs.railway.com, railpack.com), checked 2026-10-17. **unverified** = not confirmed from a primary page.

## 1. App config (host-neutral)
- **One build, one process.** Build: `npm run build` (web build into `apps/web/dist`). Start: `node apps/server/src/main.ts`, which serves the SPA, `/ws`, `/healthz` and `/api/lan` on `PORT`, bound to `HOST`.
- **Env (names only):**

| Name | Meaning | Secret |
|---|---|---|
| `PORT`, `HOST` | listen port (host-injected) and address (`0.0.0.0` on a host) | no |
| `MOONVEIL_ENGINE` | `rules` (never `fixture`) | no |
| `MOONVEIL_DATA_DIR` | restart recovery directory; on Railway, inside the volume | no |
| `MOONVEIL_PUBLIC_ORIGIN` | the public URL players open. Set = hosted deploy: allowed on `/ws` even if the proxy rewrites `Host`; `/api/lan` returns `[]`; no port-range warning | no |
| `MOONVEIL_ALLOWED_ORIGINS` | optional extra `/ws` origins, comma-separated (e.g. a custom domain) | no |
| `LIVEKIT_URL`, `LIVEKIT_PUBLIC_WS` | LiveKit Cloud project URLs (all four `LIVEKIT_*` or none) | no, project-specific |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud keys | **yes**: Railway dashboard only, as sealed variables. Never committed, never in the client bundle (it reads no env) |

- **Never set on a host:** `MOONVEIL_PERSIST` (disabling persistence is unapproved), `MOONVEIL_TEST_TIME_SCALE`, `MOONVEIL_TEST_SEED`, `MOONVEIL_ENGINE=fixture`, `MOONVEIL_FIXTURE_MS`, `E2E_*`.
- **Code:** `apps/server/src/deploy.ts` + `apps/server/test/deploy.test.ts`. 0009's Render-only switches (`RENDER`, `RENDER_EXTERNAL_URL`) are replaced by `MOONVEIL_PUBLIC_ORIGIN`; platform glue lives in `deploy/`. The startup line now logs `persist=<dir>|off`.
- **Platform files:** `deploy/railway.ts` (primary), `deploy/render.yaml` (alternative). Both are drafts, inactive and checked by tests.

## 2. Railway facts (2026-10-17)
| Topic | Fact | Source |
|---|---|---|
| Trial | one-time $5 credit, expires in 30 days; 1 GB RAM, shared vCPU (plans page: 2 vCPU), 0.5 GB volume, 5 services per project. **Full Trial** needs GitHub verification; the **Limited Trial** restricts outbound network and ports. Card requirement: **unverified** | pricing/free-trial, pricing/plans |
| After the trial | reverts to the Free plan: $1 credit/month, 0.5 GB RAM, 1 vCPU, 0.5 GB volume, 1 replica. Trial volumes are deleted 30 days after credits expire. Whether services stop when the $1 runs out: **unverified** | free-trial, plans |
| Hobby | $5/month, always charged, includes $5 of usage per cycle (no rollover); usage above $5 is billed as the difference. Post-paid card required (no prepayment). Rates: RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB, volume $0.15/GB-month. Limits: 48 GB RAM, 48 vCPU, 5 GB volume, 6 replicas | plans |
| Spend cap | usage limits on all plans: an email alert at a soft limit; at the hard limit all workloads go offline. Minimum hard limit $10 | usage-limits |
| Region | Southeast Asia Metal (Singapore) `asia-southeast1-eqsg3a`. Plan restrictions on regions: none stated | deployment-regions |
| Volume | persistent data for a service, mounted at a chosen path (e.g. `/data`); `RAILWAY_VOLUME_MOUNT_PATH` is injected. "Replicas cannot be used with volumes". Redeploys with a volume have "a small amount of downtime" (no two deployments mount it at once). Non-root images may need `RAILWAY_RUN_UID=0`. Survival across redeploys: the deployments page recommends a volume "for data that must survive deployments"; an explicit restart guarantee is not stated (**unverified wording**, smoke test checks it) | volumes reference, deployments |
| Volume backups | manual or scheduled (daily 6 d, weekly 27 d, monthly 89 d retention); restore creates a new volume in the same project and environment only. Plans that include backups: **unverified** | backups |
| Volume files | `railway volume files download <remote> <local>` / `upload <local> <remote>` (files or directories), `railway volume browse`; also sftp/scp via `railway ssh` | cli/volume, volumes reference |
| Deploys and restarts | a redeploy sends SIGTERM to the old deployment, with 0 s draining by default (`RAILWAY_DEPLOYMENT_DRAINING_SECONDS`), then SIGKILL. Railway also starts **mandatory** redeploys to move a service between hosts (maintenance, faults). Ephemeral storage: 1 GB Free, 100 GB paid | deployments |
| Health check | at deploy time only (not monitored afterwards); any 2xx; default timeout 300 s; requests come from host `healthcheck.railway.app`; uses `PORT`, which Railway injects | healthchecks |
| WebSockets / proxy | WebSocket over HTTP/1.1; WebSockets are exempt from the 15-min/5-min HTTP limits and "can stay open indefinitely, even while idle"; 10,000 connections. Proxy headers: `X-Forwarded-Proto` (always https), `X-Forwarded-Host` ("original host header"), `X-Real-IP`. Whether `Host` reaches the app unchanged: **unverified** (covered by `MOONVEIL_PUBLIC_ORIGIN`) | public-networking specs-and-limits |
| Railway domain | `RAILWAY_PUBLIC_DOMAIN` = bare domain like `example.up.railway.app` (no scheme). Generated domains are not part of the IaC file | variables reference, IaC reference |
| Serverless (app sleeping) | a per-service toggle (Settings → Deploy → Serverless). Sleeps after ~10 min (other page: 5–10 min) without **outbound** traffic; the first request after sleep may 502. Default off is implied, not stated (**unverified**). Websocket servers with long-lived clients are listed as a poor fit. **Must stay off** | guides/cut-idle-costs-serverless, app-sleeping |
| Node (Railpack) | version from `RAILPACK_NODE_VERSION` > `devEngines.runtime` > `engines.node` > `.nvmrc` > `.node-version`; default `lts`. Our `engines` (`>=24.12`) has no upper bound, so we pin it. npm workspaces are supported; the `build` script runs if defined; runtime `NODE_ENV=production`. Whether devDependencies are installed at build: **unverified**, so we pin `RAILPACK_NODE_NPM_INSTALL='npm ci --include=dev'` | railpack.com/languages/node |
| Config files | `railway.json`/`railway.toml` (Config as Code) is **deprecated**: files stop being read on 2026-12-01. The replacement is Infrastructure as Code: `.railway/railway.ts` with the `railway` npm package, applied by `railway config plan` / `apply` (not on push). Serverless and restart policy are not in the IaC DSL (dashboard) | config-as-code, infrastructure-as-code (+ reference) |
| Variables | reference syntax `${{ VAR }}` (same service), `${{SERVICE.VAR}}`; **sealed** variables are hidden in the UI/API/CLI but passed to builds and deploys; variables are available at build and runtime | guides/variables |

## 3. Railway service settings (exact)
In `deploy/railway.ts` (IaC draft), or set by hand in the dashboard with the same values:
- Source: this repo, the branch chosen at deploy approval. Build `npm run build`; start `node apps/server/src/main.ts`; health check `/healthz`.
- Region `asia-southeast1-eqsg3a`; **1 replica**.
- Volume `moonveil-rooms` mounted at `/data` (0.5 GB fits Trial and Free; room files are KBs).
- Env: `RAILPACK_NODE_VERSION=24.20.0` (the version all checks ran on), `RAILPACK_NODE_NPM_INSTALL`, `HOST=0.0.0.0`, `MOONVEIL_ENGINE=rules`, `MOONVEIL_DATA_DIR=/data/rooms`.
- Dashboard only: `MOONVEIL_PUBLIC_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}` (reference variable; whether this same-service reference resolves Railway-provided vars is checked at the smoke test). The four `LIVEKIT_*`, with key and secret **sealed**.
- Dashboard only: generate the Railway domain; **Serverless off**; restart policy left at default (on failure, **unverified** default); no `RAILWAY_RUN_UID` unless the volume is not writable (the server then fails at start with an `EACCES` from `mkdir`, so it's visible).
- IaC needs the `railway` npm package, a new dependency not added. A first playtest can use dashboard settings alone. Note: the `railway config` commands are run by whoever holds the account.

## 4. Restart recovery on Railway (approved behaviour, unchanged)
- `fileRoomStore` writes each room snapshot on change (atomic rename, 0600) to `MOONVEIL_DATA_DIR` on the volume. At start the server restores every room; downtime counts as paused time (0003).
- Covers every restart kind: a crash restart, a redeploy, and Railway's mandatory host migrations. With 0 s draining the old process is SIGKILLed: recovery after SIGKILL is already tested (`restart.test.ts`; e2e `robustness.spec.ts` SIGTERM and SIGKILL, passing on `5b081c4`). Locally on foundation-9: create a room → SIGKILL → restart gives `restoredRooms=1`.
- Clients see a short disconnect during the redeploy downtime, then reconnect and resume (backoff reconnect in `client.ts`).
- **So the `durable` flag and the restart notice aren't needed on Railway** with a volume: nothing is lost on restart. They matter only for a host without durable storage (Render Free, 0009 option a, unapproved). Proposal: withdraw both unless that option is chosen.

## 5. Moving room data between hosts (planned, between sessions)
- **What's stored:** one `<CODE>.json` per open room in `MOONVEIL_DATA_DIR`. Files contain seat tokens and secret roles, so treat them as secrets. They are deleted when a room closes; rooms close after 30 min with no connection (`MOONVEIL_ROOM_IDLE_MS`), so between sessions the directory is usually empty.
- **Export (Railway):** with no session running, `railway volume files download /rooms ./rooms-export`. Volume backups (§2) are for restoring in the same project, not for moving.
- **Import (Railway):** `railway volume files upload ./rooms-export /rooms`, then restart the deployment; rooms are read only at start. Same app SHA and `MOONVEIL_ENGINE` on both sides (snapshots are `v: 1`, but engine state can change between SHAs; a snapshot from another engine is skipped, not misread).
- **Render:** Free has no disk, so there's nothing to export and anything imported is lost on the next restart. A paid Render disk would take files via its shell/SSH (**unverified**).
- **Limits:** no live migration. A room moved to a different public URL can't be resumed by its players: resume tokens live in each browser's `localStorage`, which is per origin. Moving rooms only helps when the same origin (a custom domain) moves with them; otherwise a move starts fresh. Delete local copies after the move.

## 6. Choice for decision: trial vs. paid
Measured on foundation-9: idle server RSS ≈ 121 MB, CPU ≈ 0%. Bandwidth ≈ 20 MB per 10-seat match including cold page loads (0009 §2).

| Option | Money | Limits | Risks |
|---|---|---|---|
| **Trial** | $0 (one-time $5 credit) | 30 days; 1 GB RAM, 0.5 GB volume | Needs the **Full** trial (GitHub verification): the Limited trial restricts outbound network, and the server must reach LiveKit Cloud's API (port 443; whether the Limited trial allows it is **unverified**). After 30 days it drops to Free ($1/month, 0.5 GB RAM). Our always-on ~0.12 GB costs ~$1.2/month in RAM alone, so Free won't cover a month (**estimate**). Trial volume data is deleted 30 days after expiry |
| **Hobby** | **$5/month flat** expected: estimated usage ~$1.5–2.5/month (RAM ~0.12 GB → ~$1.2; CPU near idle → ~$0.2–0.4; volume ≤ 5 GB → ≤ $0.75; egress ~1 GB for ~50 matches → $0.05) is under the included $5 | 5 GB volume, no sleep, no expiry | Card required; set a hard usage limit ($10 minimum) as a spend cap |

**Recommendation:** start on the **Trial** for the first playtests, provided the account gets the Full trial. Upgrade to **Hobby** before day 30 (or at once if only the Limited trial is granted), so the volume and its rooms carry over. LiveKit Cloud Build stays $0 within 5,000 participant-minutes/month (~10–12 voice matches; 0008).

## 7. Open items
- **Smoke test after deploy approval:** `/healthz`; `Host`/`Origin` as the server sees them; `MOONVEIL_PUBLIC_ORIGIN` resolved; the startup line shows `persist=/data/rooms`; a match on 2 phones + a laptop; a redeploy mid-match restoring the room.
- **LiveKit Cloud compatibility and testing plan:** voice owner (link pending, as in 0009 §5). LiveKit Cloud probes and credentials remain unapproved.
- **Decisions for Human:** Trial vs. Hobby (above); withdraw the `durable` flag and restart notice (§4); IaC (`railway` package) vs. dashboard-only settings; deploy approval.
