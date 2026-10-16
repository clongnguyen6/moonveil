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

Not proposed: platforms whose free tiers sleep the process or lack UDP and persistent disk. They break in-memory rooms and LiveKit (0007).

## Recommendation (for decision)
- **First playtest without voice:** any one of the three works for the server + Caddy shape. For a few days, Fly.io's verified prices put a 1 GB Machine plus volume plus IPv4 at roughly $9/month prorated. Hetzner is likely cheaper but its prices are unverified here. Oracle is $0 with the idle-reclamation risk.
- **With voice:** a plain VPS (Hetzner-class or Oracle) is the simplest place for LiveKit (any UDP port, TURN on 5349). Fly needs the UDP specifics above and wasn't verified for LiveKit.
- **Decisions for Human:** provider, spend (if any), DNS name/account, and whether voice is in the first playtest.
