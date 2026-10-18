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
- Env: `RAILPACK_NODE_VERSION=24.20.0` (the version all checks ran on), `RAILPACK_NODE_NPM_INSTALL`, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=5` (§4), `HOST=0.0.0.0`, `MOONVEIL_ENGINE=rules`, `MOONVEIL_DATA_DIR=/data/rooms`.
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
- **Restart notice (best effort; implemented on foundation-9, decided by Lead 2026-10-17):**
  - On SIGTERM/SIGINT the server saves every room (`Registry.saveAll`), refuses new upgrades (503), closes every socket with the standard WebSocket code **1012 (Service Restart)** (`CLOSE.serviceRestart`), waits up to 1 s for the close handshakes, then exits 0.
  - Railway: `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=5` (in `deploy/railway.ts`) so the notice leaves before SIGKILL. Render already allows 30 s.
  - Client (UI P15): a 1012 close keeps the token and reconnects as before. `ClientState.lastCloseCode` holds the close code of the last connection that dropped after it had opened. Failed reconnect attempts (1006 while the server is down) don't overwrite it; the watchdog's own drop sets `null`; the next welcome clears it. The UI maps `1012` to "Your match is saved and paused until the server is back", and anything else to neutral copy (UI owner's).
  - Why: the client starts reconnecting at once instead of possibly waiting out the 25 s watchdog, and players learn why the overlay appeared.
  - Limits: best effort only. Crashes, OOM kills, host faults and a SIGKILL without draining give no notice; the UI behaves the same without it (plain `reconnecting`).
  - Tests: `apps/server/test/shutdown.test.ts`, three cases:
    - in-process stop: 1012 and reason, the room on disk, a new server restores it, and the client resumes the same seat with its pre-shutdown state;
    - upgrades refused while stopping;
    - the real `main.ts` process: SIGTERM gives 1012 and exit 0, the room is on disk, and the restarted process logs `restoredRooms=1` and the client resumes.
  - `apps/server/test/client-close.test.ts`: the real web client (`client.ts`, in Node with browser globals stubbed) against real servers. A 1012 close sets `lastCloseCode` to 1012; refused retries keep it; resuming on the restarted server clears it; an abrupt TCP drop gives 1006, so neutral copy.

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
  - plain: `RAILPACK_NODE_VERSION=24.20.0`, `RAILPACK_NODE_NPM_INSTALL=npm ci --include=dev`, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=5`, `HOST=0.0.0.0`, `MOONVEIL_ENGINE=rules`, `MOONVEIL_DATA_DIR=/data/rooms`, `MOONVEIL_PUBLIC_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}`;
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
  - [ ] **Restart recovery on the volume:** start a match; redeploy mid-match. Expect the 1012 restart notice (client `lastCloseCode === 1012`), the reconnect overlay, then resume on the same seats with roles kept, timers paused through the gap, and `restoredRooms≥1` in the new startup line. Repeat with a restart (not only a redeploy).
  - [ ] **Voice reachability** (after step 8): sessions issued per seat, audio both ways, wolves-only at night.
  - [ ] Usage before and after the session recorded (§6).

### 7a. Appendix (draft): checks after a deploy, in the Railway dashboard
For the person holding the Railway account; no programming needed. Do the parts in order. **If any check says STOP:** do nothing further, take a screenshot, and send it with the part number. Never upgrade, add a card or switch hosts to get past a STOP. Dashboard wording that Railway's docs don't confirm is marked *(label unverified)*; if the screen differs, look for the closest match or STOP and ask.

**A. Before anything: trial type and time left**
1. Open railway.com and sign in. Look at your account or workspace plan *(label unverified)*.
2. It must say **Trial** and must **not** say "Limited" anywhere (for example "Limited Trial" or "Limited access"). Railway's docs don't say where this is shown; railway.com/verify is the documented route from Limited to Full.
   - STOP if you see "Limited", or if a payment or upgrade screen appears.
3. Note the credit left and the days left.
   - STOP if under $1 or under 5 days.

**B. Service settings** (open the project, click the **moonveil** service, then its **Settings**)
1. **Region:** Southeast Asia (Singapore).
2. **Replicas:** 1 *(label unverified)*. Never more.
3. **Serverless:** Settings → Deploy → Serverless. It must be **off**. If it's on, switch it off.
4. **Public domain:** generate a Railway domain *(Networking section; label unverified)*. Write it down. It looks like `something.up.railway.app`.

**C. Variables** (service → **Variables** *(label unverified)*; add each name with exactly this value)

| Name | Value |
|---|---|
| `RAILPACK_NODE_VERSION` | `24.20.0` |
| `RAILPACK_NODE_NPM_INSTALL` | `npm ci --include=dev` |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `5` |
| `HOST` | `0.0.0.0` |
| `MOONVEIL_ENGINE` | `rules` |
| `MOONVEIL_DATA_DIR` | `/data/rooms` |
| `MOONVEIL_PUBLIC_ORIGIN` | `https://${{RAILWAY_PUBLIC_DOMAIN}}`, typed exactly, braces included |

- **Do not add** any name starting with `MOONVEIL_TEST`, `E2E_` or `MOONVEIL_PERSIST`, and not `MOONVEIL_FIXTURE_MS`.
- **Voice, only after LiveKit is approved:** `LIVEKIT_URL`, `LIVEKIT_PUBLIC_WS`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Mark the last two as **sealed** (Railway hides sealed values for good). Add all four or none. Never paste these values into chat, issues or the repo.

**D. Volume**
1. Add a volume to the moonveil service *(how: label unverified; Railway's docs describe it, and the CLI form is `railway volume add --mount-path /data`)*.
2. **Mount path:** `/data`. **Size:** the smallest offered, at most 0.5 GB (the Trial limit).
   - STOP if it asks for a plan upgrade.

**E. Deploy and read the first log line**
1. Deploy the revision named in the deploy request (Lead provides it).
2. Open the deployment's **logs**. Within a minute or two you should see one line starting `moonveil server`. It must contain all of these:
   - `engine=rules`
   - `voice=off` (or `voice=wss://…` once voice is set up)
   - `persist=/data/rooms`
   - `restoredRooms=0` on the very first deploy
   - STOP if the deploy fails, if the line never appears, or if it shows `persist=off` or another path.
   - STOP if you see `EACCES` or `permission denied`: report it; the likely fix, `RAILWAY_RUN_UID=0`, is decided by us, not tried blind.
3. Open `https://<your domain>/healthz` in a browser. It must show `ok`. STOP otherwise.

**F. Game page and connection**
1. Open `https://<your domain>` on a laptop and on a phone. Both show the start screen.
2. Laptop: enter a name, then **Create & play**. A small **Connected** label appears. STOP if it keeps showing "Reconnecting…".
3. Phone: open the invite link the laptop shows. It must start with `https://<your domain>/r/`. Join with another name; both see each other in the lobby.
4. **Idle test:** leave both on the lobby for **20 minutes** without touching them (screens on). Afterwards both still show Connected, and no "Reconnecting…" screen has appeared. If one did, write down roughly when and STOP.

**G. Restart check (rooms survive on the volume)**
1. Keep the lobby from F open on both devices. Each player taps **Ready**.
2. In the dashboard, restart the service: the deployment's **⋮** menu → **Restart** *(label unverified)*.
3. On both devices a "Reconnecting…" screen appears, then within about a minute both are back in **the same lobby**, with the same names and ready marks. STOP if either lands on the start screen or sees "room not found".
4. In the logs, the new `moonveil server` line shows `restoredRooms=1` (or more).
5. Repeat steps 2–4 with **Redeploy** instead of Restart (same menu). Expect a slightly longer gap.
6. Mid-match version (needs at least 7 players, so do it at the first real playtest only if everyone agrees): restart during a day phase. Everyone returns to the same seat and role, and the timer continues from where it paused.

**H. Voice reachability** (only after LiveKit is approved and the four `LIVEKIT_` variables are set)
1. Redeploy. The `moonveil server` line now shows `voice=wss://…`.
2. Create a room with the laptop and a phone, allow the microphone, and speak: each hears the other in the lobby.
3. In the logs, look for lines starting with `voice ` that mention `fetch failed`, `ETIMEDOUT`, `ECONNREFUSED` or `ENOTFOUND`. If any appear, the service can't reach LiveKit Cloud (this is what a Limited Trial would cause): **STOP**.

**I. Usage page** (before and after every session, and once after an idle day)
1. Open your workspace settings → **Usage**.
2. Write down the date and time, the total used so far, and the moonveil project's CPU, memory, network (egress) and volume figures. The CLI `railway usage projects --project moonveil` shows the same.
3. Send the numbers after each session.
   - STOP if credit left drops under $1 or under 5 days remain. Stop the service between sessions (remove its active deployment; *label unverified*); don't upgrade. We then present the measured usage and the options.

### 7b. Dashboard steps for the approved deploy (Railway Trial, revision `deploy-trial`)
For the account holder. Approved 2026-10-17: Railway Trial only, revision pinned by branch `deploy-trial`, voice via LiveKit Cloud, automatic-mode playtest first. No upgrade, no card, no spend.

**STOP** means: do nothing more, screenshot, report. Never upgrade or pay to get past one. *(label unverified)* = Railway's docs don't confirm the exact wording; pick the closest match, or STOP and ask.

1. **Project.** Railway → New Project → Deploy from GitHub repo → `clongnguyen6/moonveil`. In the service's Settings → Source, set the branch to **`deploy-trial`** *(label unverified)*.
   - A first build may start and fail before the steps below are done. Ignore that until step 6.
2. **Service settings** (service → Settings):
   - Region: **Southeast Asia (Singapore)** (`asia-southeast1-eqsg3a`).
   - Replicas: **1** *(label unverified)*.
   - Settings → Deploy → **Serverless: off**.
   - Build command: **`npm run build`** (corrected 2026-10-17, see the correction below)
   - Start command: `node apps/server/src/main.ts`
   - Healthcheck path: `/healthz`
3. **Volume:** add a volume to this service, mount path **`/data`**, the smallest size, at most 0.5 GB *(label unverified)*. STOP if it asks for an upgrade.
4. **Domain:** Settings → Networking → **Generate Domain** *(label unverified)*. If it asks for a port, enter **8080**. Write down the domain, e.g. `something.up.railway.app`.
5. **Variables** (service → Variables; type each name and value exactly):

| Name | Value | Note |
|---|---|---|
| `RAILPACK_NODE_VERSION` | `24.20.0` | Node version (Railpack reads this first) |
| `PORT` | `8080` | same as the domain's port in step 4 |
| `HOST` | `0.0.0.0` | |
| `MOONVEIL_ENGINE` | `rules` | |
| `MOONVEIL_DATA_DIR` | `/data/rooms` | on the volume from step 3 |
| `MOONVEIL_PUBLIC_ORIGIN` | `https://<domain from step 4>` | `https://`, no trailing slash |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `5` | gives the restart notice time |
| `LIVEKIT_URL` | `https://<project>.livekit.cloud` | `<project>` = the subdomain in the LiveKit Cloud dashboard |
| `LIVEKIT_PUBLIC_WS` | `wss://<project>.livekit.cloud` | same `<project>` |
| `LIVEKIT_API_KEY` | `API…` from LiveKit Cloud | **secret: seal it** |
| `LIVEKIT_API_SECRET` | from LiveKit Cloud | **secret: seal it** |

   - The four `LIVEKIT_` variables go in all together or not at all; a partial set stops the server at startup.
   - Type the secrets only into Railway. Never put them in chat, git, screenshots or logs.
   - **Never set:** `MOONVEIL_PERSIST`, `MOONVEIL_TEST_TIME_SCALE`, `MOONVEIL_TEST_SEED`, `MOONVEIL_FIXTURE_MS`, `MOONVEIL_ENGINE` with any value other than `rules`, any `E2E_…`, `MOONVEIL_LAN`, `NODE_ENV`, or `RAILWAY_RUN_UID` (only if we ask).
6. **Deploy** (Deploy / Redeploy). STOP if the build fails; send the build log.
7. **First log line:** Deployments → the latest one → logs *(label unverified)*. Within a minute or two, look for:
   `moonveil server http://0.0.0.0:8080 engine=rules voice=wss://<project>.livekit.cloud persist=/data/rooms restoredRooms=0`
   - STOP if: the line never appears; `persist=` isn't `/data/rooms`; it shows `voice=off` although the four `LIVEKIT_` variables are set; you see `voice: set all of LIVEKIT_URL…` (a partial set); or you see `EACCES` / `permission denied`.
8. **Health:** open `https://<domain>/healthz`. It must show `ok`.
9. **Full or Limited Trial** (outbound check; the pinned code has no startup probe):
   1. Open `https://<domain>`, enter a name, **Create & play**. You're now in a lobby.
   2. Within about 30 s, read the service logs.
   - Lines starting `voice sync <CODE>:` or `voice <CODE>:` that mention **ENOTFOUND, ECONNREFUSED, ETIMEDOUT or EAI_AGAIN** mean the service can't reach LiveKit, most likely the **Limited Trial**: **STOP and report. Never upgrade.**
   - `401` or `unauthenticated` means a wrong key or secret: re-type both once, redeploy, re-check; STOP if it repeats.
   - No `voice` lines means outbound works.
   - What Limited breaks: only the server's calls to LiveKit. The game and text chat still work; players see "voice unavailable".
10. **Hand-off:** send Lead the domain (not the secrets). Agents then run `scripts/postdeploy-check.mjs` against it, and will ask you once to **Restart** and once to **Redeploy** (the deployment's ⋮ menu, *label unverified*).
11. **Usage:** record the workspace Usage page (§7a I) before and after each session.
    - STOP if credit drops under **$1** or under **5 days** remain.
    - Never add a card or upgrade.
    - `deploy-trial` stays pinned at the approved revision; nobody pushes to it, so redeploys rebuild the same commit.

**Correction (2026-10-17): the build command was wrong.** The deploy failed at build with `npm error code EBUSY syscall rmdir path /app/apps/web/node_modules/.vite`.
- **Cause, from Railpack's source** (`railwayapp/railpack`, `core/providers/node`, read 2026-10-17):
  - Railpack's install step already runs `npm install` with `NODE_ENV=production`, `NPM_CONFIG_PRODUCTION=false` and `CI=true`. The last of these keeps devDependencies, so `vite` is installed.
  - Its build step mounts caches at `/app/node_modules/.cache` and, for a Vite app, at `/app/apps/web/node_modules/.vite`.
  - A custom Build Command replaces only the build step's command; the install still runs before it (docs.railway.com/builds/build-configuration).
  - `npm ci` deletes an existing `node_modules` first, so it tried to remove a mount point: EBUSY.
  - Pruning (`RAILPACK_PRUNE_DEPS`) is off unless set.
- **Fix:** Build command `npm run build`. Railpack does the install. Don't set `RAILPACK_PRUNE_DEPS`, `RAILPACK_INSTALL_CMD` or `RAILPACK_NODE_NPM_INSTALL`.
- **My local validation missed it** because it never reproduced Railpack's cache mounts. The new simulation:
  - install from manifests only with Railpack's install env (`vite` and all `@moonveil/*` workspace links present, lockfile unchanged);
  - then the full source and `npm run build` with the same env;
  - then the start command: `/healthz` `ok`, create works, `restoredRooms=0`.
- **Not reproduced:** the BuildKit mount itself (EBUSY). That needs a real mount, not available here without system changes. It is established from the source and the exact path.

**Validated locally (2026-10-17, clean worktree at the pinned revision, Node 24.20.0, Railway-like env; superseded for the build step by the correction above):**
- The build command passes with `NODE_ENV=production`. A plain `npm ci` under `NODE_ENV=production` omits `vite` and the build fails, hence `--include=dev`.
- At startup: the startup line shows `persist=<dir>/rooms restoredRooms=0`; `/healthz` → `ok`; `/` and `/r/<CODE>` serve the SPA; `/api/lan` → `[]`.
- `/ws` opens for the public origin even with a rewritten `Host`, and refuses a foreign origin and the `http:` form of the public origin (403).
- Create and join work.
- SIGTERM: both clients get close 1012 and the process exits 0. The restart logs `restoredRooms=1`, and both clients resume the same seats with their lobby state.

### 7d. Live state (2026-10-18): `f12761a` deployed
- **Running:** `f12761aa730b691ec8bebf12bd4c9fecc115f733` on the Railway Trial; `deploy-trial` was fast-forwarded from `35151f2`.
- **Variables:** `MOONVEIL_PUBLIC_ORIGIN=https://www.moonveil.id.vn` and `MOONVEIL_ALLOWED_ORIGINS=<railway.app URL>`. No `MOONVEIL_REVISION`; `MOONVEIL_ROOM_IDLE_MS` unset (30 min). Approved: no main merge, no spend.
- **Executed as two documented deploys,** because mobile has no Alt + Deploy and a staged Deploy redeploys the current code:
  1. **Restart check** on `35151f2`, 23:41Z (lobby `CYR2J8`): close 1012, back in ~5 s, same room and seats.
  2. **Deploy 1**, "Apply 2 changes → Deploy": `35151f2` with the new variables. From 04:26Z both hosts accept both origins, and foreign and cross-host `http:` origins are refused (403); a fresh room on `www` works (`.cache/postdeploy/deploy1-origins/`).
  3. **Deploy 2:** auto-deploy turned on, then agents pushed `deploy-trial` → `f12761a` at 04:31:17Z (fast-forward, ref verified). The push built it; the new instance served at 04:32:28Z.
     - **Revision proof:** `/api/status` returned JSON with `revision=f12761a…`. That comes from Railway's `RAILWAY_GIT_COMMIT_SHA`, since `MOONVEIL_REVISION` isn't set.
     - **Status:** `persist={mode: volume, path: /data/rooms}`, `voice=configured`.
     - **Persistence:** test lobby `TKZ4FS` dropped with close 1012 and came back in ~16 s, same room and seats.
     - **Origins:** both work on both hosts; foreign and cross-host `http:` refused. A fresh room on `www` works (`24G56Q`). Evidence: `.cache/postdeploy/deploy2/`.
- **Account holder still to do:** auto-deploy back off; screenshot of the source commit; `restoredRooms` / `skippedRooms` from the startup line; usage snapshot.
- **Fixed by this deploy:** persistence across restart and version change is now verified live (it was on hold), and `Host` preservation still holds.

### 7d-old. Live state before the release (2026-10-17; pinned revision, Railway Trial)
**Verified from outside** (`scripts/postdeploy-check.mjs`, evidence in `.cache/postdeploy/live/` and `.cache/postdeploy/www-check.jsonl`)
- **Reachability and app:** `/healthz` ok; `/` and `/r/<CODE>` load; `/api/lan` = `[]`; a foreign origin is refused on `/ws` (403); create + 2 joins through the real UI with 3 pages. All of this on both `https://moonveil-production-b733.up.railway.app` and `https://www.moonveil.id.vn`.
- **Idle:** 3 pages connected for ~76 min with 0 reconnects.
- **Voice:** the server reached LiveKit's API (sessions issued); 3 browsers connected to LiveKit Cloud in ~1 s; ≤ 0.5 participant-minutes used.
- **`Host` is preserved by Railway's proxy, at least on the custom domain.** A `www` page's `/ws` (Origin `www`, Host `www`) opens through the same-origin rule, although `MOONVEIL_PUBLIC_ORIGIN` is still the railway.app URL. The only case refused is a `www` origin sent to the railway.app host, which the browser client never does.

**Untested live**
- **Persistence across a restart and a redeploy on Railway.** Both 30-minute windows expired without the account holder's action. On hold, by decision 2026-10-18. The local equivalents pass: SIGTERM gives 1012 and `restoredRooms=1` with the same seats; SIGKILL then start gives 1006 and the same seats (`.cache/postdeploy/dryrun.jsonl`), plus the browser restart tests in every full acceptance run.
- **Retry:** ready as `postdeploy-check.mjs … --no-voice --idle-min=0 --actions=2 --then-origin=https://www.moonveil.id.vn`. It needs the account holder's Restart and Redeploy.
- **Not seen from outside:** the startup line (`persist=/data/rooms`, `voice=…`, `restoredRooms`), so whether rooms are written to the volume rather than the ephemeral disk; and the trial type (Full or Limited), although LiveKit was reached, which argues against an outbound block.

**Origin switch (§7c): not applied, and not needed for `www` to work.** `MOONVEIL_PUBLIC_ORIGIN` is still the railway.app URL. Applying §7c makes it name `www`, and keeps railway.app pages working through `MOONVEIL_ALLOWED_ORIGINS`. Do it at the next planned redeploy, between sessions.

### 7c. Custom domain `www.moonveil.id.vn` (state 2026-10-17; origin switch combined with the redeploy check)
**Done by the account holder**
- CNAME `www` → `76wjlnn2.up.railway.app` plus the `_railway-verify.www` TXT record; the domain is green in Railway.
- There's no apex domain: their DNS can't do an apex CNAME, and the Trial allows 1 custom domain.
- `curl -I https://www.moonveil.id.vn` returns HTTP/2 200 (railway-hikari, sin1), so TLS is valid.

**Checked against the pinned revision's code** (`deploy.ts`, `server.ts`, `client.ts`; local run on 127.0.0.1)
- `MOONVEIL_PUBLIC_ORIGIN=https://www.moonveil.id.vn` plus `MOONVEIL_ALLOWED_ORIGINS=https://moonveil-production-b733.up.railway.app` gives the allowed origins `[www, railway.app]`. `/api/lan` stays `[]`.
- `/ws`, with a rewritten `Host`: both origins open. `https://evil.example`, `http://www.moonveil.id.vn` and `https://76wjlnn2.up.railway.app` are refused (403).
- A bare `www.moonveil.id.vn` (no `https://`) stops the server at startup (`Invalid URL`). A trailing `/` is accepted.
- Invite links and QR codes use the **page's own origin** (`inviteBase()` → `location.origin` off loopback), not `MOONVEIL_PUBLIC_ORIGIN`. A player on the railway.app address shares railway.app links; a player on `www` shares `www` links.
- Resume tokens and microphone permission are per origin (`localStorage`). Opening the other address means no seat there: in a lobby that player must join again with a **different name** (their old seat still holds the name, `name-taken`); in a running match they can't get their seat back.

**Redeploy step = origin switch** (one deployment; it is the §7b hand-off's Redeploy)
1. Service → Variables: set `MOONVEIL_PUBLIC_ORIGIN` to `https://www.moonveil.id.vn`, and add `MOONVEIL_ALLOWED_ORIGINS` = `https://moonveil-production-b733.up.railway.app`. Exact values, `https://`, no spaces.
2. Apply the change. Railway stages variable edits and offers a Deploy / apply button *(behaviour and label unverified)*. Applying it creates the new deployment, which **is** the redeploy. Click ⋮ → Redeploy only if no new deployment starts.
3. The first log line must show `persist=/data/rooms` and `restoredRooms=1` (or more).
   - STOP and revert both variables if the log shows `Invalid URL` or `origin must be http(s)`, or the health check fails.

**Players in existing sessions**
- Pages already open on railway.app keep working through the redeploy: they reconnect, resume the same seats, and their origin stays allowed.
- From the next session, everyone opens `https://www.moonveil.id.vn`, and hosts share links from there.
- Don't switch address mid-session: the seat token doesn't carry over.

**Later (optional):** after a session on `www`, remove `MOONVEIL_ALLOWED_ORIGINS`, between sessions.

### 7e. Next deploy request: release bundle (draft; the revision is filled in after its full acceptance)
**Config deltas** (dashboard; everything else stays as §7b)

| Variable | Now | New | Why |
|---|---|---|---|
| `MOONVEIL_PUBLIC_ORIGIN` | `https://moonveil-production-b733.up.railway.app` | `https://www.moonveil.id.vn` | the setting names the real domain (§7c/§7d) |
| `MOONVEIL_ALLOWED_ORIGINS` | unset | `https://moonveil-production-b733.up.railway.app` | pages still open on railway.app keep connecting |
| `MOONVEIL_ROOM_IDLE_MS` | unset (30 min) | `7200000` (2 h) | a break doesn't close the room (decision-maker to approve) |
| `MOONVEIL_REVISION` | unset | `<bundle SHA>` | `/api/status` reports the revision even if `RAILWAY_GIT_COMMIT_SHA` isn't set at runtime (unverified). Update it on every deploy |

**Revision move** (agent, after approval): `git push origin <bundle SHA>:refs/heads/deploy-trial`, a fast-forward from `35151f2`. Then verify `git rev-parse origin/deploy-trial`.
- Railway may build on push. If it doesn't, the account holder clicks Deploy.
- **Rollback:** Railway's previous deployment (⋮ → Rollback, *label unverified*). The branch can't be moved back without a force push (forbidden).

**Saved matches across the revision change** (rules-16 + foundation-14):
- An in-progress match saved by 35151f2 (rules version 1) is **skipped** on restore. The log shows `room <CODE> skipped reason=in-progress match saved under rules version 1; this engine runs version 2`, and the startup line counts `skippedRooms`.
- Lobby and finished rooms restore.
- Still deploy between sessions: a skipped match is lost for its players. They see "room not found" on resume.

**Sequence with the persistence check** (each wait ≤ 30 min; agents never trigger a deploy)
1. **Agents** start run A on the *current* revision:
   `postdeploy-check.mjs https://moonveil-production-b733.up.railway.app --no-voice --idle-min=0 --actions=2 --then-origin=https://www.moonveil.id.vn`
   3 pages on railway.app, in a lobby. Then agents send "READY FOR RESTART".
2. **Account holder: Restart.** Run A checks resume, the 1012 or 1006 close code, the gap and the same seats. Agents send "RESTART OK, READY FOR VARIABLES".
3. **Account holder:** apply the four variable deltas. That redeploys the current revision with the new config; it already supports these variables. Run A checks resume, then that `/ws` works on both hosts and origins, foreign origins are refused, and a fresh create + join works on `www`.
4. **Agents** start run B, then move `deploy-trial` to the bundle SHA. That push, or the account holder's Deploy, is run B's one action:
   `postdeploy-check.mjs https://www.moonveil.id.vn --no-voice --idle-min=0 --actions=1 --expect-revision=<bundle SHA>`
   Run B checks that its lobby survives the revision change, then that `/api/status` reports the revision, `persist.mode=volume` and `voice=configured`.
5. **Account holder:** the first log line of the new revision shows `persist=/data/rooms restoredRooms≥1 skippedRooms=0`, plus the `room … restored` lines; a skipped line means a match was running. Usage snapshot (§7a I).

**Stop rules**
- Any check fails: stop, report, and revert the variables (step 3) or roll back the deployment (step 4).
- No upgrades, and no switch of host.

### 7f. Deploy request: release candidate `f12761a` (revised 2026-10-18; approved and executed 2026-10-18 as two deploys, see §7d)
**One controlled deployment** of Git SHA `f12761aa730b691ec8bebf12bd4c9fecc115f733` with its variables. `deploy-trial` moves from `35151f2` as a fast-forward (`35151f2` is an ancestor, 57 commits).

Railway facts (docs.railway.com, checked 2026-10-18):
- Services linked to GitHub "automatically deploy when new commits are pushed to the connected branch"; that can be turned off in Service Settings.
- "Deploy Latest Commit" (⌘K) deploys the connected branch's latest commit.
- Variable edits are staged; "Hold Alt while clicking Deploy to commit the staged changes without triggering a redeploy. The new values apply on the next deploy."
- "Wait for CI" holds deployments until GitHub Actions finish, and skips them after 2 h. This repo has **no workflows**, so it must be **off**.
- Exact labels: *unverified*.

**0. Before (Human, report each)**
1. No match running.
2. Usage snapshot: credit and days left. Stop if under $1 or under 5 days.
3. Service Settings → source and trigger: the branch is `deploy-trial`; auto-deploy on or off; Wait for CI on or off. Wait for CI must be off.

**1. Restart check on the current version** (no build)
- Agents start the check with 3 pages on railway.app in a lobby: `--actions=2 --then-origin=https://www.moonveil.id.vn --expect-revision=f12761a…`. Then they send **READY FOR RESTART**.
- Human: deployment ⋮ → **Restart**.
- Agents check resume on the same seats, then send **RESTART OK, READY TO STAGE**.

**2. Stage the variables, without deploying** (Human: service → Variables)
- `MOONVEIL_PUBLIC_ORIGIN` = `https://www.moonveil.id.vn`
- add `MOONVEIL_ALLOWED_ORIGINS` = `https://moonveil-production-b733.up.railway.app`
- *optional, separate approval:* add `MOONVEIL_ROOM_IDLE_MS` = `7200000`
- **Don't** set `MOONVEIL_REVISION`. It's only a self-label, and it would hide `RAILWAY_GIT_COMMIT_SHA` in `/api/status`.
- **Commit with Alt + Deploy** (no redeploy). If there's no such option, or a plain Deploy is the only choice: **don't deploy; stop and report.**
  - Fallback (two deploys, each honest): first move the revision with the old variables, which `f12761a` accepts; then apply the variables.

**3. The one build: `f12761a`**
- Agents push `f12761a` to `deploy-trial` and verify `origin/deploy-trial` = `f12761a…`.
- If auto-deploy is on, that push is the build. If it's off, Human: ⌘K → **Deploy Latest Commit**. Exactly one deployment starts. Send a screenshot.

**4. Proof and persistence**
- **Revision**, all must agree, else **stop**:
  - Railway's deployment details show source commit `f12761a…` (Human screenshot);
  - `/api/status` returns a **JSON body** with `revision`, `persist` and `voice`. An HTTP 200 alone proves nothing: `35151f2` has no such route, and its SPA fallback answers 200 with `index.html`;
  - `/api/status` `revision` is `f12761a…`, or `unknown` if Railway gives no commit at runtime.
- **Startup line** (Human, logs): `moonveil server … persist=/data/rooms restoredRooms=N skippedRooms=M`.
  - `M ≥ 0` is fine: old-version in-progress matches are skipped by design; report `M`.
  - `N ≥ 1`, and the agents' test lobby has a `room <CODE> restored …` line.
- **Agents' check:**
  - the test lobby resumes on the same seats;
  - `/api/status` shows `persist.mode=volume` and `voice=configured`;
  - both origins work, foreign origins are refused, a fresh create + join works on `www`.
  - Then they send **DEPLOY OK**.
- Human: usage snapshot.

**Stop and roll back**
- Any failed check, a failed build or health check, more than one deployment, or a revision mismatch: **stop**, screenshot, report.
- Roll back: Railway → the previous deployment (`35151f2`) → ⋮ → **Rollback** *(unverified)*.
  - The committed variables can stay: `35151f2` accepts them (§7c).
  - `deploy-trial` is never moved back (that would need a force push); a later fix moves it forward.
- An upgrade or payment prompt: stop. Never upgrade.

**Evidence**
- `.cache/runs/full-f12761a/summary.txt`: `check`, matches and voice matches ×10, strict UI 16/16, 711/711; 3 s click wait; one 4 fps scene observer per match (test mitigation).
- `restore-compat.test.ts`, with the real 35151f2 fixtures.
- §7c (origins validated against the deployed code), §7d (live state), `scripts/postdeploy-check.mjs`.

## 8. Open items
- **LiveKit Cloud compatibility and testing plan:** voice owner (link pending, as in 0009 §5). LiveKit Cloud probes and credentials remain unapproved.
- **Decisions for Human:** IaC (`railway` npm package, a deploy-time step) vs. dashboard-only settings; deploy approval with the package above.

## 9. Playtest-readiness gates (draft, 2026-10-17)
A playtest runs only when every gate in G1–G4 is **met** or explicitly waived by the decision-maker. Status is as of 2026-10-17 from the repo and `ROOM_STATE.md`; "open" means not met.

### G1. Deploy revision
| Gate | Status | Evidence / owner |
|---|---|---|
| G1.1 One exact `dev` revision is named for deploy | open: Lead names it in the deploy presentation | Lead |
| G1.2 That exact revision passed the full acceptance sequence under the lock (`npm ci`, `check`, matches ×10, matches with voice ×10, strict UI) | met for the current `dev` head; any later `dev` change needs a new run before deploy | foundation; `.cache/runs/full-<sha>/summary.txt` (DONE, every step rc=0) |
| G1.3 It contains the host-neutral deploy config (`MOONVEIL_PUBLIC_ORIGIN`), the 1012 restart notice, D2 (explicit voice join) and D5 (lobby voice-mode switch) | met since foundation-10 | `apps/server/src/deploy.ts`, `server.ts`, `apps/web/src/client.ts`; tests `deploy`, `shutdown`, `client-close`, `client-voice`, `voice-mode` |

### G2. Human decisions still needed
| Gate | Status | Evidence / owner |
|---|---|---|
| G2.1 **Batch B, pace** (B1 night split, B2 discussion length, B3 nomination/Yes-No/Hunter times, B4 Hunter turn ends on shot). Blocks the first playtest | open; the app runs on the "Recommend" column meanwhile | Human; recorded by the rules owner (`docs/rules/DECISIONS_REMAINING.md`) |
| G2.2 **Batch C, moderator powers** (C1 moderator speaks, C2 act for a player, C3 set the Wolves' target, C4 removal, C5 no rule-breaking). Blocks a *moderated* playtest only; D7 waits on C1 | open; an automatic-mode playtest doesn't need it | Human; rules owner |
| G2.3 **LiveKit Cloud** probes and credentials. Needed for voice and for the §7 step 5 outbound probe | not approved | Human; the voice owner owns the Cloud compatibility doc and test plan (link pending, §8) |
| G2.4 **Voice-off first playtest** (if G2.3 isn't granted in time): an explicit yes, since §7 step 5 otherwise stops the deploy | open | Human |
| G2.5 **Deploy approval** for the §7 package: Railway Trial only; how the revision is pinned (`railway up` from a clean checkout, or a branch at the SHA; a merge into `main` needs its own approval) | not approved | Human; Lead presents |
| G2.6 Hosting trust: the server host can read secrets (accept, and guide a non-player host) | asked | Human (`ROOM_STATE.md`) |
| Not blocking | Batches D–E rule details, balance follow-ups, the `railway` npm package (dashboard-only settings avoid it) | as listed in their docs |

### G3. Known limitations (stated to the decision-maker before the playtest; not gates to clear)
| Limitation | Fact | Owner of the follow-up |
|---|---|---|
| L1 Scene performance is measured only in test conditions | Headless Chromium renders the scene in software. One `low` scene at laptop size cost ~850 % CPU in its GPU process (A/B on `4408c64`). No real-device numbers yet | visual owner: phone performance on a GPU path |
| L2 Acceptance runs the scene at 4 fps on one observer per match | Reduced-motion emulation, a test-environment mitigation. It shows the UI works with a scene mounted; it is not performance evidence | foundation (harness); visual owner (product performance) |
| L3 LiveKit Cloud is untested | Voice is verified only against local LiveKit OSS (grant d). Gateway compatibility on Cloud, revocation, room rotation minutes and the 5,000-minute cap are unverified | voice owner |
| L4 No real devices | All phone results are browser emulation (Pixel 7 Chromium, iPhone 15 WebKit). No real iPhone or Android, and no real microphone or speaker audio in foundation's suites | first playtest; voice and visual owners for their device checks |
| L5 Railway facts not confirmed by docs | `Host` preservation (since observed live on the custom domain, §7d), Serverless default off, volume survival wording, trial-type indicator, card requirement, several dashboard labels | checked by §7a; account holder |
| L6 Restarts interrupt play | A redeploy, restart or host migration drops every player. They see the reconnect overlay and resume with the room restored and paused. The 1012 notice is best effort; crashes give none | foundation (documented, §4) |
| L7 Costs and bandwidth are estimates | ~$1.5–2.5/month and ~20 MB per match come from rates and local measurements, not from Railway's usage page | account holder measures during the trial (§6) |
| L8 Balance evidence is from bots | `docs/rules/BALANCE.md`; bots aren't players | rules owner; playtest feedback |

### G4. After deploy, before players join
| Gate | Status | Evidence / owner |
|---|---|---|
| G4.1 §7a parts A–G pass (trial type, settings, variables, volume, first log line, connection and idle, restart and redeploy recovery) | partly: reachability, app, idle and origin verified live (§7d). Restart and redeploy recovery are **untested live** (on hold); startup line and trial type need the account holder | foundation (live checks); account holder |
| G4.2 §7a part H (voice reachability) passes, or G2.4 says voice off | met from outside (§7d): sessions issued, browsers connected to LiveKit Cloud | foundation |
| G4.3 §7a part I usage baseline recorded; stop rules (§6: under $1 or 5 days) in force | open | account holder |
