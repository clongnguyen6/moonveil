# 0009: Playtest hosting on Render (SPA + game server) + LiveKit Cloud (voice)

Status: **documented alternative** (2026-10-17). Railway is the primary host (0010); the app config is host-neutral (0010 §1). Paper and repo config only: no account actions, spend, credentials or deploys. Supersedes the candidate list in 0008.
**Durable recovery (approved requirement) on Render needs a paid instance + disk (§3 b):** Free has no disk, so the draft `deploy/render.yaml` keeps persistence on by default (no `MOONVEIL_PERSIST`) but on `plan: free` rooms still won't survive a restart.
Facts are from Render's primary docs, checked 2026-10-17 (pages carry no last-updated date). **unverified** = not confirmed from a primary page.

## 1. Render service config
Draft Blueprint: `deploy/render.yaml`. It is inactive until a Blueprint is created from it (account action). Guarded by `apps/server/test/deploy.test.ts`.

| Item | Value | Why / source |
|---|---|---|
| Service | `type: web`, `runtime: node`, `plan: free`, `region: singapore` | nearest region to the players (0008); regions list: render.com/docs/blueprint-spec |
| Instances | `numInstances: 1` | rooms live in memory (0007); Free is one instance anyway |
| Build (repo root) | `npm ci --include=dev && npm run build` | the web build needs devDependencies (Vite, TS). `--include=dev` holds whether or not `NODE_ENV=production` is set at build time (docs say runtime only) |
| Start (repo root) | `node apps/server/src/main.ts` | serves `apps/web/dist` + `/ws` + `/healthz` on one port |
| Node | `NODE_VERSION=24.20.0` | the version every check ran on; root `engines` is `>=24.12`. Precedence: `NODE_VERSION` > `.node-version` > `.nvmrc` > `engines`; the default for new services is 24.21.0 (render.com/docs/node-version) |
| Bind | `HOST=0.0.0.0`; `PORT` injected by Render (default 10000) | services must bind 0.0.0.0 on `PORT` (render.com/docs/web-services) |
| Health check | `/healthz` (200 `ok`) | path must answer 2xx/3xx within 5 s. Whether Free services run health checks is not stated (**unverified**) |
| Auto-deploy | `autoDeployTrigger: off` | a deploy replaces the instance and closes every WebSocket (all matches end). Deploy by hand between sessions, after approval |
| WebSocket | same origin, `wss://<service>.onrender.com/ws` | the client derives `wss` from `location.protocol` (`client.ts`); TLS ends at Render's load balancer |
| Invite links | `inviteBase()` → `location.origin` = the public `https://<service>.onrender.com` | the page isn't on loopback, so `/api/lan` is not used (code read: `client.ts:61`) |

### Environment (names only)
| Name | Set where | Secret | Note |
|---|---|---|---|
| `NODE_VERSION`, `HOST`, `MOONVEIL_ENGINE=rules` | render.yaml | no | `MOONVEIL_PERSIST` is never set: disabling persistence (§3 a) is unapproved |
| `MOONVEIL_PUBLIC_ORIGIN` | dashboard (`sync: false`) | no | `https://<service>.onrender.com` (= `RENDER_EXTERNAL_URL`); see §4 |
| `MOONVEIL_DATA_DIR` | dashboard (`sync: false`) | no | the disk mount + `/rooms` if a paid disk is attached (§3 b) |
| `LIVEKIT_URL`, `LIVEKIT_PUBLIC_WS` | dashboard (`sync: false`) | no, but project-specific | Cloud project URLs; all four `LIVEKIT_*` or none (server refuses to start otherwise) |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | dashboard only (`sync: false`) | **yes** | Render's server-side env only. Never committed, never in render.yaml values, never in the client bundle |
| `MOONVEIL_ALLOWED_ORIGINS` | optional | no | extra `/ws` origins (§4), e.g. a custom domain |
| `PORT`, `RENDER`, `RENDER_EXTERNAL_URL`, `RENDER_EXTERNAL_HOSTNAME` | injected by Render | no | only `PORT` is read by the server (host-neutral since foundation-9) |

- The client bundle reads no env: no `import.meta.env` or `VITE_*` in `apps/web/src` (grep, 2026-10-17). Voice tokens reach a browser only per seat, in `voice` messages (0004).
- **Never set on Render** (test-only): `MOONVEIL_TEST_TIME_SCALE`, `MOONVEIL_TEST_SEED`, `MOONVEIL_ENGINE=fixture`, `MOONVEIL_FIXTURE_MS`, and all `E2E_*` (`E2E_TIME_SCALE`, `E2E_SEED`, `E2E_GREP`, `E2E_VOICE`, `E2E_UI_STRICT`, `E2E_PORT`, `E2E_REAL_PORT`, `E2E_RESTART_PORT`).

## 2. Render Free: facts (2026-10-17)
| Topic | Fact | Source |
|---|---|---|
| Idle spin-down | after 15 min without inbound traffic; "This includes both HTTP requests and WebSocket messages from existing connections". Whether ws pong control frames (our 10 s ping) count is **unverified**: assume not | render.com/docs/free |
| Cold start | "about one minute"; HTTP visitors see Render's loading page. Clients connected at spin-down lose the socket. Our client retries and, once the instance is back, `resume` gets `room-not-found` (rooms were in memory). Upgrade behaviour during spin-up is **unverified** | docs/free; client.ts |
| Instance hours | 750 Free hours per workspace per calendar month, consumed while running. When exhausted, all Free services are suspended until next month. One always-on service uses ≤ 744 h | docs/free |
| Other suspension | Render may suspend a Free service that "initiates an uncommonly high volume of traffic over the public internet" | docs/free |
| Bandwidth | Free services count against the workspace's included outbound bandwidth: Hobby 5 GB/month (Pro 25 GB). Overage $0.15/GB; without a payment method, services stay down until next month | docs/free; render.com/docs/outbound-bandwidth |
| WebSockets | supported; no maximum duration enforced. Connections close when an instance is replaced (deploy/restart). SIGTERM, then 30 s grace (up to 300 s configurable). Render advises ping/pong, backoff reconnect and shared state | render.com/docs/websocket |
| Restarts | "Render might restart a Free web service at any time" | docs/free |
| Filesystem | ephemeral: changes are "lost every time the service redeploys, restarts, or spins down" | docs/free |
| Persistent disk | not on Free ("Free web services cannot"); paid web services only. A disk forces a single instance and disables zero-downtime deploys; daily snapshots kept ≥ 7 days | docs/free; render.com/docs/disks |
| Keeping awake | the Free page says nothing about pinging (neither allowed nor forbidden) | docs/free |
| Prices (paid instance, disk) | **unverified**: render.com/pricing rendered without numbers | — |
| Free RAM/CPU | **unverified** (instance-types page 404). Server heap measured at 10–14 MB (seed-search runs) | — |

**Bandwidth estimate** (measured 2026-10-17, foundation-8, in-process with bot clients). One 10-seat match ending on day 3–4 sends 2.0–2.9 MB of game-socket frames in total (full per-seat snapshots, no compression). The SPA is 1.5 MB raw per first load, and assets are cached as immutable. So one match is ≈ 3 MB of frames plus ≈ 15 MB if all 10 players load cold, ≈ 20 MB in total. 5 GB ≈ 250 matches/month, so bandwidth is not the binding limit. Voice media goes to LiveKit Cloud, not Render. Ghost poses and chat volume were not measured.

## 3. Restart recovery: decision needed
Today: `fileRoomStore` in `MOONVEIL_DATA_DIR` restores rooms after a process restart on the same disk (0003). On Render Free the disk doesn't survive a restart, a spin-down or a deploy, so persistence can't work there.

| Option | What it means | Cost | Work |
|---|---|---|---|
| **(a) Persistence off** | `MOONVEIL_PERSIST=0`. Any restart, spin-down or deploy ends every match in progress. The UI must say so (UI owner); nobody claims matches survive | $0 | config only (not in the render.yaml draft: unapproved). UI copy: UI owner |
| (b) Paid instance + Render disk | `MOONVEIL_DATA_DIR=<mount>/rooms`; the existing store works unchanged; no spin-down on paid | paid instance + disk, prices **unverified** (owner reads them in the dashboard) | config only; a restart smoke test on Render |
| (c) External durable store (free tier) | Render Key Value Free has no persistence (data lost on restart): **unusable**. Render Postgres Free: 1 GB, expires 30 days after creation (14-day grace), no backups. Other providers (e.g. a hosted Redis or Postgres free tier): **unverified**, plus a new account | $0 within limits | `RoomStore` is synchronous today. Needs an async adapter (write-behind queue, awaited restore before `listen`, failure handling), unit tests on a fake, and a restart test against the real store. Snapshots hold seat tokens and secret roles, so they would sit with a third party. ~1 agent-day plus account set-up |
| (d) Keep the instance up | (d1) **in-session keepalive**: the client sends a tiny app message every ~5 min while connected, so idle lobbies or pauses don't spin down. It keeps the service up only while people play (real use), within 750 h. (d2) an external pinger 24/7: not recommended. Docs are silent; it hides a Free limit and doesn't stop restarts or deploys | $0 | (d1): new `ClientMessage` (`t:'ka'`, no reply, no state change), a client timer, server ignore + tests. Small. Not implemented |

**Recommendation (pending, sent for decision): (a) + (d1)** if Render is used for the first playtests. Railway with a volume (0010 §4) keeps the approved recovery and needs none of this. It costs $0, takes config plus a small protocol/client change, and the risk left is honest: a Render-initiated restart or a deploy ends matches (deploys are manual, so not during a session). Move to (b) if a playtest loses a match or playtests become regular. (c) costs more work than (b) and adds third-party data exposure.
Until the decision: recovery code is unchanged, and (b), (c) and (d1) are not implemented.

## 4. Readiness gaps
Done on foundation-8 (repo-safe; unset env = previous behaviour), `apps/server/src/deploy.ts` + `apps/server/test/deploy.test.ts`:
- **Origin check vs. proxy Host.** Whether Render's proxy keeps `Host` = the public name is **unverified**. If it doesn't, the same-origin check would refuse every `/ws` upgrade. Now, extra exact origins are allowed: `MOONVEIL_PUBLIC_ORIGIN` (foundation-9; foundation-8 read `RENDER_EXTERNAL_URL` when `RENDER=true`), plus `MOONVEIL_ALLOWED_ORIGINS`. Same-origin is unchanged; other origins are still refused; no `X-Forwarded-*` is trusted. Test: an allowed origin with a rewritten Host passes; an unlisted origin and a wrong scheme are refused. Nothing in the server uses client IPs (rate limits are per seat), so no proxy IP trust is needed.
- **`/api/lan` on a host.** With `HOST=0.0.0.0` it would list the container's internal IPs. Now off when `MOONVEIL_PUBLIC_ORIGIN` is set or `MOONVEIL_LAN=0` (returns `[]`; the client already ignores it off loopback).
- **Port-range warning** skipped when `MOONVEIL_PUBLIC_ORIGIN` is set (4100–4199 is a workstation rule).
- **render.yaml draft**, with a test that it contains no test-only vars or `MOONVEIL_PERSIST`, no secret values, one instance and `/healthz`.

Proposed (need a decision or another owner):
- **(d1) keepalive** as above (protocol + client: mine; no UI change).
- Both below are needed only for a host without durable storage (option a); on Railway with a volume they aren't (0010 §4).
- **Durability signal for honest UI**: add `durable: boolean` to `welcome`, so the UI shows "a server restart ends this match" when false. Shared protocol field, so it needs the UI owner's agreement. Test: server reports false with `MOONVEIL_PERSIST=0`, true with a store.
- **Restart notice**: implemented differently on foundation-9 as a best-effort WebSocket close 1012 on SIGTERM (0010 §4). Render's 30 s SIGTERM grace is enough for it.
- **First smoke test on Render** (after deploy approval): check `Host` and `Origin` as seen by the server, `/healthz`, a match on 2 phones + a laptop, and a reconnect.

## 5. Voice: LiveKit Cloud
- Compatibility of `LiveKitVoiceGateway` with Cloud, and the Cloud testing plan: **voice owner**. Link: `docs/voice/<pending>`.
- Server side needs only the four `LIVEKIT_*` names above. Build-plan limits (5,000 participant-minutes/month hard cap, 100 concurrent) and the minutes estimate per match: 0008 (history).

## Decisions for Human
1. Restart recovery: (a)+(d1) recommended; or (b) or (c).
2. Durability signal and restart notice (protocol additions, with the UI owner).
3. Deploy approval (Blueprint creation, dashboard secrets, first manual deploy, smoke test).
