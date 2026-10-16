# 0007: Deployment shapes (notes only; no provisioning, deployment or costs)

Status: foundation, 2026-10-16. Corrects an earlier claim about Vercel. Nothing deployed; deployment still needs Human approval.
Sources are marked: **[vercel]** = https://vercel.com/docs/functions/websockets (fetched 2026-10-16, page last_updated 2026-08-10); **[code]** = this repo at foundation-6; **[voice]** = docs/voice (voice owner). Provider prices are deliberately absent; a later proposal must verify and mark them.

## Correction: Vercel Functions do support WebSockets
- Status: "WebSockets (Beta) are available on all plans" **[vercel]**.
- Connections: "pinned to one Vercel Function instance"; they "close when a Vercel Function reaches its maximum duration" **[vercel]**.
- Reconnects: "not guaranteed to reach the same Vercel Function instance". After a new deployment, new connections reach the new deployment while old ones stay on the previous one **[vercel]**.
- State: "Store durable state, presence, counters, rooms, and pub/sub coordination in an external data store instead of relying on in-memory variables" (e.g. Redis) **[vercel]**.
- Requires Fluid compute (default for projects created on or after 2025-04-23) **[vercel]**.

## Why Moonveil is not import-and-play there (or on any multi-instance/serverless host)
1. **One process is the authority for a room.**
   - Rooms live in an in-memory `Map` (`apps/server/src/rooms.ts` `Registry`). Phase wake-ups are `setTimeout`s in that process (`room.ts` `scheduleWake`). Presence is "this socket is attached here".
   - Every seat of a room must reach the same process. Two instances would split a room in two.
   - Making it multi-instance means external state, pub/sub and distributed timers: a redesign, not a deploy setting **[code]**.
2. **Restart persistence is local disk** (`store.ts`, `MOONVEIL_DATA_DIR`, atomic rename). It needs a persistent volume; an ephemeral function filesystem loses it **[code]**.
3. **Same-origin WebSocket + origin check.**
   - The client derives `ws(s)://<page host>/ws` from `location` (`apps/web/src/client.ts`).
   - The server accepts an upgrade only when `Origin` host equals `Host` (`server.ts` `originOk`).
   - A different frontend origin is rejected unless configured (option b) **[code]**.
4. **Function max duration closes sockets.** The client resumes by token (built), but the resume must reach the process that holds the room (point 1).
5. **LiveKit media needs its own host:** signaling behind TLS, plus UDP range or TCP fallback, plus TURN for strict NATs **[voice: RECOMMENDATION.md, SECURE_CONTEXT.md]**. That doesn't fit a function runtime.
6. **Heartbeat and idle sweep** are in-process intervals (`server.ts`) **[code]**.

## Option (a): single host (recommended shape)
- **What:** one long-lived Node ≥ 24.12 process serves the SPA, `/ws` and `/api/lan`, and persists rooms. One instance only; many rooms per process is fine (0003: 0.1 ms and 33 KB per state change at 16 players).
  ```
  npm ci && npm run build
  MOONVEIL_ENGINE=rules HOST=127.0.0.1 PORT=4100 MOONVEIL_DATA_DIR=/srv/moonveil/rooms node apps/server/src/main.ts
  ```
- **TLS front** (Caddy/nginx, see 0002) terminating HTTPS: preserve `Host` and forward the WebSocket upgrade on `/ws`.
- **Host needs:** a long-lived process, a persistent volume for `MOONVEIL_DATA_DIR`, WebSocket support, a public TLS name.
- **Later, LiveKit:** alongside on the same host, or its own host with UDP/TCP/TURN; the same TLS front proxies its signaling **[voice]**.
- **Code changes:** none for the core.

## Option (b): split host (static frontend + separate WebSocket server)
Same single-instance server, without static files. Exact changes, none built:

| # | Where | Change |
|---|---|---|
| 1 | `apps/web` build | `VITE_MOONVEIL_SERVER=wss://game.example.com` at build time. `client.ts` uses it for the WebSocket URL when set, else same-origin as today. `/api/lan` fetches use the same base. |
| 2 | server `originOk` | `MOONVEIL_ALLOWED_ORIGINS=https://play.example.com[,…]`. When set, the upgrade is accepted only if `Origin` is in the list (exact match); otherwise the same-origin rule stays. |
| 3 | server static | `STATIC_DIR=''` (already supported: no static serving). |
| 4 | static host | rewrite `/r/*` to `index.html` (SPA route for invite links). |
| 5 | invite links | `inviteBase()` already returns the page origin, i.e. the static frontend, which is correct. `/api/lan` is only meaningful for single-host LAN play. |
| 6 | `/api/lan` | add CORS only if the split frontend needs it (it shouldn't). |
| 7 | persistence/instances | unchanged: one WebSocket server instance with a persistent volume (points 1–2 above). |

Vercel could host the static part of (b) [unverified for this app; not evaluated]. Running the WebSocket server on Vercel Functions would need the multi-instance redesign above: out of scope.
