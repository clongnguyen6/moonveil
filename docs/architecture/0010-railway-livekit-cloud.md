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
| Trial | one-time $5 credit, expires in 30 days; 1 GB RAM, shared vCPU (plans page: 2 vCPU), 0.5 GB volume, 5 services per project. Card requirement: not stated (**unverified**) | pricing/free-trial, pricing/plans |
| Full vs. Limited Trial | Full Trial = "full network access", after GitHub verification (or railway.com/verify). **Limited Trial**: code, databases and buckets deploy, but services have "restricted outbound network access" and "only a limited set of ports". Which ports: not documented. How to tell which one an account has: not documented (no badge or setting described); **unverified**. A Railway forum answer (not primary) says a trial can drop back to Limited if verification criteria stop being met | pricing/free-trial; station.railway.com (forum) |
| Credits exhausted or expired | "Your services may be stopped by Railway" when trial credits are exhausted; stopped deployments are removed and redeployed automatically if fixed within 30 days, else by hand; "Railway will not remove the volume attached to the service". But trial-created volumes are deleted "30 days after the expiration of your credits". The account then reverts to the Free plan ($1 credit/month, no rollover; 0.5 GB RAM, 1 vCPU, 0.5 GB volume). No automatic upgrade or charge is described | pricing/faqs, pricing/free-trial, pricing/plans |
| Hobby (not chosen) | "$5 / month" is a **minimum usage commitment**: "you always pay the $5 subscription fee", which "covers your first $5 … of resource usage each month". Usage above that is billed: "you will be charged the delta". Examples: $3 usage → $5 bill; $8 → $8; $15 → $15. Subscription billed in advance, overage in arrears; Railway "may charge a partial amount earlier in the billing cycle". Post-paid card | pricing/understanding-your-bill, pricing/plans |
| Usage rates (all plans) | RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB, volume $0.15/GB-month, metered per minute | pricing/plans |
| Usage limits | custom email alert (resources keep running) and a **hard limit**: "Once your resource usage hits the specified hard limit, all your workloads will be taken offline". It covers **resource usage** (compute: CPU, memory, storage, egress; agent usage is separate). The docs don't say it bounds the whole invoice: the Hobby minimum is charged regardless, so it is not an invoice cap. Minimum $10. Reminders at 75/90/100 %. Railway calls it "a possibly destructive action". Volume data at the hard limit, enforcement lag or overshoot: **not documented** | pricing/cost-control |
| Usage visibility | Workspace settings → Usage: by project and resource. CLI `railway usage` (current usage, current and estimated bill, limits) and `railway usage projects --project <name>` (CPU, memory, egress, volume, backup per service); 90 days of history. Railway needs about a week of running for an estimate and gives no quotes | pricing/faqs, cli/usage |
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
- **Deploy-time step (not in the repo):** IaC needs the `railway` npm package. It is not added; adding it is a dependency decision to ask for at deploy approval (then: copy `deploy/railway.ts` to `.railway/railway.ts`, `railway config plan`, `apply`, run by whoever holds the account). A first playtest can use dashboard settings alone.

## 4. Restart recovery on Railway (approved behaviour, unchanged)
- `fileRoomStore` writes each room snapshot on change (atomic rename, 0600) to `MOONVEIL_DATA_DIR` on the volume. At start the server restores every room; downtime counts as paused time (0003).
- Covers every restart kind: a crash restart, a redeploy, and Railway's mandatory host migrations. With 0 s draining the old process is SIGKILLed. Recovery after SIGKILL is already tested: `restart.test.ts`, and e2e `robustness.spec.ts` with SIGTERM and SIGKILL, passing on `5b081c4`. Locally on foundation-9: create a room → SIGKILL → restart gives `restoredRooms=1`.
- **A volume makes recovery durable; it doesn't remove the interruption.** A redeploy, a crash restart or a host migration still drops every connected player. Railway documents "a small amount of downtime" for redeploys with a volume, and stops are abrupt by default (SIGTERM with 0 s draining, then SIGKILL). Nothing guarantees any warning before a kill.
- **What players experience** (current client and UI, read 2026-10-17):
  1. The socket closes, or goes silent and the client's 25 s watchdog gives up.
  2. The UI shows its reconnect overlay: "Reconnecting… Your seat is kept. The game continues." (UI owner's copy; during server downtime the game is actually **paused**, not continuing).
  3. The client retries with backoff (0.25, 0.5, 1, 2, then every 4 s, +≤30 % jitter) until the server is back.
  4. The client resumes the same seat. The room is restored from the volume with roles, votes and timers; downtime counts as paused time, and the engine also pauses while all player seats are disconnected.
  - Voice sessions are re-issued on resume.
  - Lost: at most an action that was in flight at the kill (its ack never arrives; the player re-acts if the step is still open).
- **`durable` flag: keep withdrawn.** On this setup every restart ends in resume, so there's nothing different to warn about. It matters only on a host without durable storage (0009 option a, unapproved).
- **Restart notice: recommend a small best-effort version.**
  - What: on SIGTERM the server closes every socket with the standard WebSocket close code **1012 (Service Restart)** instead of the current silent terminate, then exits. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=5` so the close frames leave before SIGKILL.
  - Why it's worth having: the client starts reconnecting at once instead of possibly waiting out the 25 s watchdog if the proxy holds a dead connection, and the UI owner can then show "Server restarting, your match is saved" (true with a volume).
  - Cost: additive, a few lines plus one test. The current client already treats any close other than replaced or left as "reconnect", so it works before any UI change. The UI copy is the UI owner's.
  - Limits: best effort only. Crashes, OOM kills, host faults and a SIGKILL without draining give no notice, so the UI must behave the same without it.
  - Status: proposal; not implemented until decided.

## 5. Moving room data between hosts (planned, between sessions)
- **What's stored:** one `<CODE>.json` per open room in `MOONVEIL_DATA_DIR`. Files contain seat tokens and secret roles, so treat them as secrets. They are deleted when a room closes; rooms close after 30 min with no connection (`MOONVEIL_ROOM_IDLE_MS`), so between sessions the directory is usually empty.
- **Export (Railway):** with no session running, `railway volume files download /rooms ./rooms-export`. Volume backups (§2) are for restoring in the same project, not for moving.
- **Import (Railway):** `railway volume files upload ./rooms-export /rooms`, then restart the deployment; rooms are read only at start. Same app SHA and `MOONVEIL_ENGINE` on both sides (snapshots are `v: 1`, but engine state can change between SHAs; a snapshot from another engine is skipped, not misread).
- **Render:** Free has no disk, so there's nothing to export and anything imported is lost on the next restart. A paid Render disk would take files via its shell/SSH (**unverified**).
- **Limits:** no live migration. A room moved to a different public URL can't be resumed by its players: resume tokens live in each browser's `localStorage`, which is per origin. Moving rooms only helps when the same origin (a custom domain) moves with them; otherwise a move starts fresh. Delete local copies after the move.

## 6. Plan: Railway Trial only (Human decision, 2026-10-17)
- **Trial only.** No automatic upgrade to Hobby or any paid plan; no overage or spend authorized. The durable volume and the recovery requirement stay.
- **Eligibility, before any deploy request:**
  - The account must be on the **Full** Trial. Agents have no account access, so the deploy request asks the decision-maker to confirm the trial type in Railway's dashboard. The docs don't say where it's shown (**unverified**); railway.com/verify is the documented route from Limited to Full.
  - Outbound access from the service to LiveKit Cloud must work. **What Limited would block for us:** the server's calls to the LiveKit Cloud API over HTTPS 443 (room and participant management; tokens are signed locally). Voice would fail; the game itself only needs inbound traffic and would still run. **How to tell them apart in practice:** the outbound probe in step 5 of §7. A network error or timeout while inbound HTTPS works points to Limited.
  - If either check fails: **stop and report.** Never upgrade as a workaround.
- **Credit exhaustion or expiry** (§2, docs dated 2026-10-17): services may be stopped and their deployments removed; the volume is not removed at that point, but trial volumes are deleted 30 days after credit expiry; the account falls to Free ($1/month). Plan:
  - **Stop before it happens** and present measured usage plus choices (stay stopped, a paid plan, another host). No fees incurred and no silent switch to another host.
  - Stop triggers: under 5 days of trial left, or under $1 of credit left, whichever comes first.
  - Rooms needn't be exported: they close 30 min after the last connection (§5).
- **Measuring usage during the trial** (account holder): Workspace settings → Usage, or `railway usage` / `railway usage projects --project moonveil`. Record before and after each playtest session, and once after an idle day. Report credit used per session and per idle day, by resource (CPU, memory, egress, volume).
- **Estimate (from rates and assumed usage, not measured on Railway):**
  - Assumptions, measured locally on foundation-9: idle server RSS ≈ 121 MB and CPU ≈ 0 %; ≈ 20 MB egress per 10-seat match (0009 §2).
  - Always-on cost ≈ $1.2/month of RAM (0.12 GB × $10) + ≈ $0.2–0.4 CPU + ≈ $0.08 for a 0.5 GB volume + ≈ $0.05 egress for ~50 matches. That's ≈ $1.5–2.5/month, or ≈ $0.05–0.08/day.
  - So the $5 credit should outlast the 30-day trial and **expiry, not credit, likely ends it**. Unconfirmed until the usage page shows real numbers (Railway itself needs ~1 week of data).
- **LiveKit Cloud** Build plan: $0 within 5,000 participant-minutes/month (~10–12 voice matches; 0008). Its probes and credentials are still unapproved.

## 7. Deploy request package (draft; to be presented by Lead, not approval to deploy or merge to main)
- **Revision:** the `dev` SHA that includes foundation-9 (host-neutral `MOONVEIL_PUBLIC_ORIGIN`), with the full acceptance sequence run on that exact SHA under the lock: `npm ci`, `check`, `e2e:matches`, `e2e:matches:voice`, `e2e:ui:accept`. _SHA and evidence filled in when that run exists._ `5b081c4` has a full passing run (`.cache/acc-5b081c4/summary.txt`) but lacks `MOONVEIL_PUBLIC_ORIGIN`, so it isn't the deploy revision.
- **Service:** one Railway project and one web service from this repo at that SHA. Region `asia-southeast1-eqsg3a` (Singapore). **1 replica**. Serverless **off**. Build `npm run build`; start `node apps/server/src/main.ts`; health check `/healthz`.
- **Volume:** `moonveil-rooms` mounted at `/data`, 500 MB (Trial cap 0.5 GB). `MOONVEIL_DATA_DIR=/data/rooms`.
- **Env (names; values in the dashboard only):**
  - plain: `RAILPACK_NODE_VERSION=24.20.0`, `RAILPACK_NODE_NPM_INSTALL=npm ci --include=dev`, `HOST=0.0.0.0`, `MOONVEIL_ENGINE=rules`, `MOONVEIL_DATA_DIR=/data/rooms`, `MOONVEIL_PUBLIC_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}`;
  - voice, later, all four or none: `LIVEKIT_URL`, `LIVEKIT_PUBLIC_WS`, and the **sealed** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`;
  - never: `MOONVEIL_PERSIST`, `MOONVEIL_TEST_*`, `MOONVEIL_ENGINE=fixture`, `MOONVEIL_FIXTURE_MS`, `E2E_*`.
- **Steps, each with its stop condition** (stop = do nothing further, report evidence; never upgrade, never pay, never move hosts):
  1. The decision-maker confirms in the dashboard: **Full** Trial, days and credit left. Stop if Limited, or if under 5 days or $1 is left.
  2. Create the project, service, volume, region, replica count, Serverless off, env above, and the Railway domain. Stop at any payment or upgrade prompt.
  3. Deploy the exact SHA (pinning mechanism, `railway up` from a clean checkout or a branch at that SHA: **unverified**; chosen at approval). Stop if the build or health check fails; report the logs.
  4. Check the startup line: `engine=rules voice=off persist=/data/rooms restoredRooms=0`. Stop if it differs (e.g. `EACCES` on the volume: report, and propose `RAILWAY_RUN_UID=0`).
  5. **Outbound probe**, from the service shell (`railway ssh`): a credential-free HTTPS request to the LiveKit Cloud project host. Any HTTP status means reachable; a network error or timeout means **stop and report** (likely the Limited Trial). This needs the LiveKit Cloud project URL, so it waits for the pending LiveKit approval; until then, steps 6–7 can run without voice only if the decision-maker says so.
  6. Smoke test (below). Stop on any failure; report.
  7. Usage snapshot (§6) after the smoke test.
  8. **Voice enablement: needs the pending LiveKit Cloud approvals** (probe and credentials). Then set the four `LIVEKIT_*`, redeploy, check the startup line shows `voice=<wss URL>`, and run the voice smoke items.
- **Smoke-test checklist:**
  - [ ] `GET /healthz` returns 200 over https; the SPA loads on 2 phones + a laptop (real devices at the decision-maker's side; agents report emulation only).
  - [ ] **Host and origin:** `/ws` connects from the public URL. Optional, to learn the proxy behaviour: deploy once with `MOONVEIL_PUBLIC_ORIGIN` unset; if `/ws` still connects, `Host` is preserved.
  - [ ] Invite link = `https://<domain>/r/<CODE>` (from `location.origin`); `/api/lan` returns `[]`.
  - [ ] **WebSocket idle:** a lobby left idle for 20 min (past the 15-min and 5-min HTTP limits) stays connected, with no reconnect overlay.
  - [ ] **Restart recovery on the volume:** start a match; redeploy mid-match. Expect the reconnect overlay, then resume on the same seats with roles kept, timers paused through the gap, and `restoredRooms≥1` in the new startup line. Repeat with a restart (not only a redeploy).
  - [ ] **Voice reachability** (after step 8): sessions issued per seat, audio both ways, wolves-only at night.
  - [ ] Usage before and after the session recorded (§6).

## 8. Open items
- **LiveKit Cloud compatibility and testing plan:** voice owner (link pending, as in 0009 §5). LiveKit Cloud probes and credentials remain unapproved.
- **Decisions for Human:** the best-effort restart notice (§4); IaC (`railway` npm package, a deploy-time step) vs. dashboard-only settings; deploy approval with the package above.
