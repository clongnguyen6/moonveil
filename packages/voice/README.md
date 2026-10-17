# @moonveil/voice

LiveKit adapter for Moonveil voice. Owner: voice scope. Decision and evidence: `docs/voice/`.

- `src/server/*` — `LiveKitVoiceGateway` implementing the agreed seam (`docs/architecture/0004-voice-seam.md`): `sync(room, grants) -> sessions per seat`, `sessionsFor(room, seat)`, `closeRoom(room)`; pure grant→permission mapping and rotation planning; token minting; `LiveKitBackend` + `FakeBackend`.
- `src/client/*` — browser `VoiceClient` (`applySessions` holds sessions; `join()` from a user tap connects and requests the mic (D2); `leave()`; `unlockAudio`, `setMuted`, `subscribe/getSnapshot`, `stats`) and `useVoice` React hook (`@moonveil/voice/client/react`).
- `tooling/livekit.mjs` — pinned LiveKit 1.13.10 for dev/tests; every write under `.cache/livekit/` (Linux release tarball → source build with in-repo Go dirs and HOME → Docker fallback).

```
node scripts/env.mjs npm run test -w @moonveil/voice        # unit tests (FakeBackend, no LiveKit)
node scripts/env.mjs npm run typecheck -w @moonveil/voice
node scripts/env.mjs node packages/voice/tooling/livekit.mjs start --port 4300   # local LiveKit (ports 4300–4399)
```

Rules the code enforces: no grant ⇒ not connected; visibility derived from `speak` when a seat enters a room and kept while it stays (listen-only newcomers such as ghosts, a pending Hunter or the moderator are hidden); any member leaving a channel or changing visibility class ⇒ that channel's room rotates (everyone present is removed with `revokeTokenTs` so LiveKit Cloud rejects their old tokens, then the room is deleted; new name, new tokens; `auto_create` off on OSS); publish/subscribe flips stay in-room; API calls per sync run in parallel, shuffled; `sync` resolves only after LiveKit is updated.

Wiring (Foundation): `new LiveKitVoiceGateway({ backend: new LiveKitBackend(url, key, secret), keys: { apiKey, apiSecret }, publicWsUrl })`, call `sync` once per `Room.flush()`, send each seat its sessions in a `voice` message, call `sessionsFor` on reconnect, `closeRoom` when the game room closes. Browser: `client.applySessions(msg.sessions)` on every `voice` message; `client.join()` from the "join campfire" tap (nothing connects or asks for the mic before it, D2); `unlockAudio()` if `audioBlocked`. Lobby switch in-person ↔ remote (D5): the server syncs voice grants `[]` for every seat (in-person) or the normal grants (remote); the gateway needs nothing else — `closeRoom` is for the game room closing.

## Browser full-match suite (`e2e/`)

```
node scripts/env.mjs npm run e2e -w @moonveil/voice          # 7 seats moderator (full match), 10 seats automatic (time budget), in-person
E2E_PORT=4350 LIVEKIT_PORT=4360 VOICE_E2E_SEATS=10 VOICE_E2E_AUTO_BUDGET_MS=300000 node scripts/env.mjs npm run e2e -w @moonveil/voice -- -g automatic
```
`e2e/serve.mjs` builds the web shell, starts the pinned LiveKit (4360/4361, UDP 4370–4399) and the real-engine server with
`LIVEKIT_URL`, `LIVEKIT_PUBLIC_WS`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. The spec reuses foundation's harness
(`e2e/harness`: `Table`, `Player`, wire capture) and after every step compares the measured hear-matrix (received audio energy
per channel and remote seat) with the matrix derived from each seat's own `state.voice` grants, checks rosters, and checks that
`voice` frames never carry a channel the seat lacks.

Scene in test pages: `MOONVEIL_SCENE=off|low|high` (default `off` here; the init script sets `globalThis.__MOONVEIL_SCENE`, the switch shared by all harnesses; the software-rendered scene cost 620–730 % CPU for 11 headless pages).

Needed from foundation's wiring (asked through Lead): the server reads the four `LIVEKIT_*` env vars above to build
`LiveKitVoiceGateway`; the web shell exposes its `VoiceClient` as `globalThis.__moonveil.voice` (same pattern as `__moonveil`
for the client). Optional: `MOONVEIL_RULES_CONFIG` (JSON) to shorten phase durations in automatic-mode tests.
