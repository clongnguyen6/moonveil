# 0008: Single-host playtest proposal (paper only)

Status: proposal, 2026-10-17. No accounts, no provisioning, no deployment. Costs, sign-ups and deployment need Human approval (WORKSPACE_PROTOCOL grants c/d).
Builds on 0007 option (a). TLS options: 0002 + docs/voice/SECURE_CONTEXT.md. Sources are cited with the date checked; anything not confirmed from a primary page is marked **unverified**.

## Shape
One Linux host runs:
1. **Moonveil server** (Node ≥ 24.12): SPA + `/ws` + `/api/lan`, real rules engine, restart persistence on local disk. Single instance (0007 point 1).
2. **Caddy** as the TLS front: automatic certificate for one DNS name. Proxies `/ws` (WebSocket upgrade, Host preserved; the same-origin check compares `Origin` with `Host`) and the SPA to `127.0.0.1:4100`. Later also LiveKit signaling (`/rtc`, `/twirp`) to `127.0.0.1:7880` (voice design: one TLS origin, SECURE_CONTEXT.md).
3. **Later, LiveKit OSS** on the same host (grant d), Linux release binary. Media: TCP 7881 and one multiplexed UDP port (`udp_port`, as in the voice tooling); TURN/TLS when players sit behind strict NAT.

## What gets deployed
- A checkout of the accepted `dev` SHA, then `npm ci && npm run build` (web build in `apps/web/dist`, served by the server).
- A service unit (systemd or equivalent) for `node apps/server/src/main.ts` with the env below, restarted on failure. Persistence makes restarts recoverable (0003).
- Caddyfile with one site block; LiveKit config `livekit.yaml` (later step).

## Env and config (exact)
| Variable | Value | Note |
|---|---|---|
| `PORT` | `4100` | behind Caddy only |
| `HOST` | `127.0.0.1` | not exposed directly |
| `MOONVEIL_ENGINE` | `rules` | default; never `fixture` |
| `MOONVEIL_DATA_DIR` | `/var/lib/moonveil/rooms` | persistent disk, 0700, service user only (contains tokens and secrets) |
| `LIVEKIT_URL` | `http://127.0.0.1:7880` | later step; all four LiveKit vars or none |
| `LIVEKIT_PUBLIC_WS` | `wss://<playtest name>` | same TLS origin, proxied to 7880 |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | from a root-only secrets file | never in the repo |

Never set `MOONVEIL_TEST_TIME_SCALE`, `MOONVEIL_TEST_SEED` or `MOONVEIL_PERSIST=0` on a playtest host. They are test-only.

LiveKit (later): `port: 7880`, `rtc.tcp_port: 7881`, `rtc.udp_port: 7882`, `rtc.use_external_ip: true`, `room.auto_create: false`, keys as above. TURN `tls_port: 5349` needs the certificate (voice RECOMMENDATION.md).

Host firewall / cloud rules: in 80/tcp (ACME), 443/tcp; later 7881/tcp, 7882/udp, 5349/tcp (TURN). Everything else closed.

## Step list (for after approval)
1. Human approves provider, cost, DNS name/account (0002 option B: e.g. DuckDNS + Let's Encrypt, or an owned domain).
2. Create the host; point DNS to it.
3. Install Node 24.12+, Caddy, git; create a service user and `/var/lib/moonveil/rooms`.
4. Check out the accepted SHA; `npm ci && npm run build`.
5. Install the service unit with the env above; start; `curl https://<name>/healthz`.
6. Caddy site block for `<name>` → `127.0.0.1:4100` (WebSocket and Host preserved by default; unverified for this exact config, checked at step 7).
7. Smoke test from 2 phones and a laptop: create, join by link, reconnect, one match. Then a restart mid-match: rooms restored.
8. Later: LiveKit binary + config + firewall + Caddy routes; set the four `LIVEKIT_*`; restart the server; voice smoke test.

## Candidate providers (checked 2026-10-17)
| Provider | What | Price (verified?) | UDP for LiveKit/TURN | Persistent disk | Idle/sleep | WebSockets |
|---|---|---|---|---|---|---|
| **Hetzner Cloud** (Regular Performance, shared AMD) | VPS, e.g. CPX12: 1 vCPU, 2 GB, 40 GB NVMe, 20 TB traffic (EU) | **unverified**: the plan page rendered every price field empty and showed "Price incl. IPv4". Buttons read "currently unavailable" at check time | full VM, any port (normal for a VPS; firewall is ours) | local NVMe | none (always on) | plain TCP, no proxy limits |
| **Fly.io** Machines | shared-cpu-1x 1 GB: $6.70/mo; volumes $0.15/GB-mo; dedicated IPv4 $2/mo; egress $0.02/GB NA/EU. "New organizations don't have a free tier"; trial up to 2 h runtime or 7 days | verified (docs.fly.io/about/pricing) | needs dedicated IPv4; bind UDP to `fly-global-services`, same port as external; no public IPv6 UDP; ~1300-byte MTU (docs.fly.io/networking/udp-and-tcp). LiveKit there: plausible with one multiplexed UDP port, **unverified** | volumes (attached to one Machine) | Machines can auto-stop; must be disabled (rooms are in memory between saves) | via Fly proxy; long-lived limits **unverified** |
| **Oracle Cloud Always Free** | A1.Flex up to 2 OCPU / 12 GB (1,500 OCPU-h + 9,000 GB-h per month), or 2× E2.1.Micro; 200 GB block storage; 10 TB/month egress | $0 (verified: docs.oracle.com Always Free resources). Card/account requirements **unverified** (oracle.com/cloud/free returned 403) | security rules allow UDP ingress by port range; nothing allowed without a rule; UDP fragments dropped unless ports are ALL; UDP state timeout 3 min established (docs.oracle.com Network security rules) | block volume | **idle reclamation**: instances count as idle if over 7 days p95 CPU < 20%, network < 20% and (A1) memory < 20%. A quiet playtest host can be reclaimed | plain TCP |

These three are all-in-one candidates (server + self-hosted LiveKit on one VM). Not proposed: platforms whose free tiers sleep the process or lack UDP and persistent disk. They break in-memory rooms and self-hosted LiveKit (0007). The split candidate below avoids that by moving voice to LiveKit Cloud.

## Candidate B (split): Railway (SPA + game server + volume) + LiveKit Cloud Build (voice)
Compared separately from the all-in-one self-hosted options. Priority: cheap or free initial play **with in-game voice**. A text-only session does not meet the playtest target. Checked 2026-10-17; earlier figures from the Supervisor were rechecked, not copied.

### Railway (game server + SPA, persistent volume)
| Item | Finding | Source / status |
|---|---|---|
| Trial | "$5 one-time credit (30 days)", no credit card; per service up to 2 vCPU / 1 GB, 2 replicas, 0.5 GB volume | railway.com/pricing; verified. The plans doc states the $5 grant but no duration. A "Free" plan (1 vCPU / 0.5 GB / 0.5 GB volume) is listed; its credit terms are **unverified** |
| Hobby | $5/month subscription that "includes $5 of resource usage". Usage above $5 is billed ("charged the delta"); unused allowance resets monthly. So the $5 is always charged and is not a cap | railway.com/pricing, docs.railway.com/reference/pricing/plans; verified |
| Usage billing | per second: CPU $0.00000772/vCPU-s, memory $0.00000386/GB-s, volume $0.00000006/GB-s (~$0.15/GB-month) | railway.com/pricing; verified |
| Outbound transfer | $0.05/GB (services) | railway.com/pricing; verified |
| Regions | US West, US East, EU West (Amsterdam), **Southeast Asia (Singapore)**: the nearest to Vietnam | docs.railway.com/reference/deployment-regions; verified |
| Persistent volume | one volume per service. Hobby 5 GB, Trial/Free 0.5 GB. "Replicas cannot be used with volumes", so a single instance is forced, which Moonveil needs. A small downtime on redeploy (rooms restore from disk) | docs.railway.com/reference/volumes; verified (Pro limit differs between pages: 50 GB vs 1,000 GB; irrelevant here) |
| WebSockets | supported over HTTP/1.1; exempt from the 15-minute and 5-minute idle limits ("can stay open indefinitely, even while idle"); 10,000 concurrent connections per service | docs.railway.com/networking/public-networking/specs-and-limits; verified |
| UDP | not mentioned; HTTP and TCP proxy only. So **no self-hosted LiveKit on Railway**, hence LiveKit Cloud | same page; UDP absence inferred, **unverified** |
| Sleep / always-on | Serverless (App Sleeping) is set per service: sleeps 5–10 min after the last *outbound* packet; the first request may 502. Not enabled = always on (no explicit always-on flag documented). **Must stay off**: rooms live in memory between saves, and with no connected clients the server sends nothing outbound | docs.railway.com/reference/app-sleeping; verified (default state **unverified**) |

**Estimated cost:** a Node server idling at ~0.25 GB RAM and ~0.05 vCPU around the clock costs about $2.50 memory + $1.00 CPU per month; a 0.5 GB volume about $0.08; egress (state frames) negligible. That's ~$3.6/month of usage, inside Hobby's included $5, so **~$5/month total**. The Trial ($5 for 30 days, no card) likely covers the first month. Estimate from the verified rates; actual RAM/CPU unmeasured on Railway.

### LiveKit Cloud Build (voice)
| Item | Finding | Source / status |
|---|---|---|
| Price | $0/month, "No credit card required" | livekit.com/pricing; verified |
| Included | 5,000 WebRTC participant-minutes, 50 GB downstream transfer, 1,000 agent minutes per month | livekit.com/pricing; verified |
| Concurrency | 100 participants ("connected agents and end-users across all rooms"); 100 audio subscriptions per participant | docs.livekit.io quotas and limits; verified |
| Over the allowance | "the included allowance acts as a hard cap — after you exceed it, new requests fail rather than incurring overage charges". Resets on the 1st of each month; shared across all of a user's free projects | docs.livekit.io quotas and limits; verified |
| How minutes count | "Time that a single user is connected to LiveKit Cloud via a LiveKit SDK"; 1-second increments; 10-second minimum per session. Whether one identity in several rooms counts once or per room is **unverified** | docs.livekit.io billing + quotas; partly verified |
| TURN, regions | not stated on the fetched pages | **unverified** |
| Next tier | Ship from $50/month (150,000 minutes; overage $0.0005/min WebRTC, $0.12/GB) | livekit.com/pricing; verified, not proposed |

**Minutes per 10-player, 30-minute match** (estimate from our channel model). Assumptions: a cycle is ~5–6 min, nights ~1/6 of the time; on average ~7 living and ~3 dead; ~5 min lobby. A seat holds a room only while granted:
- living by day: public;
- living wolves at night: wolves;
- ghosts: ghosts all the time, plus public (listen) by day;
- moderator: listens on all three.

| Who | Minutes |
|---|---|
| Lobby, public (10 × 5) | ~50 |
| Living by day, public (7 × 0.83 × 30) | ~175 |
| Living wolves at night (~2.5 × 0.17 × 30) | ~13 |
| Ghosts on ghosts (3 × 30) | ~90 |
| Ghosts on public by day (3 × 0.83 × 30) | ~75 |
| Moderator, moderator mode (~25 public + 5 wolves + 30 ghosts) | ~60 |

- **Total if each room connection counts:** ~460 participant-minutes (moderator mode), ~400 (automatic). Rotation adds sessions with the 10-second minimum; negligible.
- **If minutes count per identity:** ~380.
- **So the 5,000-minute Build cap ≈ 10–12 such matches a month.** After that, new connections fail until the 1st; nothing is billed.
- **Peak concurrency:** ~23 connections per match (10 seats × ≤ 2 rooms + moderator 3), so ~4 simultaneous matches under the 100 cap.
- **Transfer:** worst case (everyone speaking) is ~1.3 GB/hour per match. 50 GB is not the binding limit.

### Moonveil config on Railway (exact)
- Build: `npm ci && npm run build`. Start: `node apps/server/src/main.ts`. Node ≥ 24.12 (root `engines`; whether Railway's builder honours it is **unverified**; pin if not).
- Env:
  - `HOST=0.0.0.0` (Railway routes to the container; our default `127.0.0.1` would be unreachable);
  - `PORT` = Railway's injected port. The server warns outside 4100–4199; the warning is harmless here;
  - `MOONVEIL_ENGINE=rules`, `MOONVEIL_DATA_DIR=<volume mount>/rooms`;
  - `LIVEKIT_URL=https://<project>.livekit.cloud`, `LIVEKIT_PUBLIC_WS=wss://<project>.livekit.cloud`, `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` from the Cloud project (Railway variables);
  - no test-only variables.
- Service: Singapore region, 1 instance, volume attached, Serverless/App Sleeping **off**.
- TLS: Railway's HTTPS domain gives a secure context for the mic. The same-origin check needs the edge to keep `Host` = the public domain (**unverified**; checked at the smoke test).
- Steps (after approval): Railway account → project from the repo at the accepted SHA → volume + env + region → deploy → `/healthz` → LiveKit Cloud project + keys → set the four `LIVEKIT_*` → redeploy → smoke test (2 phones + laptop, one match with voice, a reconnect, and a restart mid-match).
- Accounts needed: Railway and LiveKit Cloud (sign-ups = Human decision). No DNS account needed (Railway domain).

### Comparison
| | A: all-in-one VM (Hetzner / Oracle / Fly) | B: Railway + LiveKit Cloud Build |
|---|---|---|
| Voice | self-hosted LiveKit (UDP, TURN on our cert); our OSS findings apply | LiveKit Cloud; gateway compatibility pending (below) |
| Money, first month | Oracle $0 (idle-reclamation risk); Hetzner **unverified**; Fly ~$9 | ~$0 (Railway trial) + $0 (Build) |
| Money, steady | Hetzner **unverified**; Fly ~$9/mo | ~$5/mo + $0 up to ~10–12 voice matches/mo |
| Ops | we run Caddy, LiveKit, TLS, firewall | we run one service; TLS and SFU managed |
| Limits | VM size; Oracle idle reclamation | voice hard cap 5,000 min/mo; volume 5 GB; one instance |
| Accounts | provider (+ DNS name) | Railway + LiveKit Cloud |

## LiveKitVoiceGateway against LiveKit Cloud (placeholder: voice owner fills this in on their branch)
Open questions for the voice owner (foundation did not test these):
- Does Cloud honour token revocation (`revokeTokenTs`), which OSS ignores? Is rotation still needed?
- Room rotation (`DeleteRoom` + new names) and the 10-second session minimum: minute/cost impact.
- Hidden participants (`hidden` grant) and `UpdateParticipant` permission flips on Cloud.
- `auto_create: false` equivalent on Cloud (stale tokens must not recreate old rooms).
- TURN/TLS and region (nearest to Vietnam), and what fails at the Build hard cap (connect error the client must surface).
- Whether `LIVEKIT_URL` (API) and `LIVEKIT_PUBLIC_WS` (signal) are the same host on Cloud; config-only or code changes.


## Recommendation (for decision; covers both candidates)
- **First playtest without voice:** any one of the three works for the server + Caddy shape. For a few days, Fly.io's verified prices put a 1 GB Machine plus volume plus IPv4 at roughly $9/month prorated. Hetzner is likely cheaper but its prices are unverified here. Oracle is $0 with the idle-reclamation risk.
- **With voice:** a plain VPS (Hetzner-class or Oracle) is the simplest place for LiveKit (any UDP port, TURN on 5349). Fly needs the UDP specifics above and wasn't verified for LiveKit.
- **Cheapest path that meets the in-game voice target: B** (Railway trial/Hobby + LiveKit Cloud Build). About $0 for the first month, then ~$5/month, within ~10–12 voice matches/month. Conditional on the voice owner's Cloud compatibility answers above.
- **Decisions for Human:** candidate (A or B), provider(s), spend, accounts/sign-ups, DNS (A only).
