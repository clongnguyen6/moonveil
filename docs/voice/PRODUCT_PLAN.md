# Voice: from spike to product code (proposal, not started)

Status: split confirmed by Human (2026-10-16); seam agreed in `docs/architecture/0004-voice-seam.md`. Built so far in `packages/voice`: server gateway (`sync`/`sessionsFor`/`closeRoom`), mapping/rotation, tokens, LiveKit backend + fake, pinned LiveKit tooling, browser `VoiceClient` + React hook, unit tests. Open: Foundation wiring, package e2e on the real server, full-match suites.

## 1. Split

**`packages/voice` (voice scope owns)** — framework-free TypeScript, no game logic.

| Module | Contents | From spike |
|---|---|---|
| `server/gateway.ts` | `LiveKitVoiceGateway implements VoiceGateway` (+ the extensions in §5 if accepted): collects `setGrants`, reconciles on `commit(room)`, `closeRoom` | `server.mjs transition/enforce` |
| `server/mapping.ts` | pure: `VoiceGrant → {canPublish, canSubscribe, canPublishData, hidden}`; room name `${code}-${channel}-g${gen}`; rotation decision (any member must leave ⇒ rotate) | `entitlements`, `roomName`, `enforce` |
| `server/tokens.ts` | `mintSession(seat, channel, roomName, perm, ttl)` with `livekit-server-sdk`; public `wss://` URL from config, never from request headers in production | `mintToken`, `livekitUrlFor` |
| `server/backend.ts` | `LiveKitBackend` (RoomServiceClient: list/update/remove/create/delete) and `FakeBackend` (in-memory, records calls) for unit tests | — |
| `client/voice-client.ts` | `VoiceClient.applySessions(sessions)`: one `Room` per session, connect/disconnect/permission-follow, `unlockAudio()` for the autoplay tap, mic state (`granted/denied/failed/muted`), re-acquire on `visibilitychange`, events: `participants(channel)`, `speaking(channel)`, `audioBlocked`, `micState` | `web/client.js` |
| `client/react.ts` | thin `useVoice(client)` hook (optional; UI stays in web/visual scope) | — |
| `tooling/livekit.mjs` | fetch/build/start/stop a pinned LiveKit for dev and tests (§2); config template with `auto_create: false` | `run.mjs`, `config/livekit.yaml` |
| `tooling/tls-proxy.mjs`, `make-certs.sh` | LAN dev/test TLS front (optional) | same |
| `test/` | unit tests (node:test) against `FakeBackend`; Playwright policy suite against real LiveKit | `tests/*.spec.ts` |

**Foundation wires** (their scope; I supply diffs for review):
- `apps/server`: construct `LiveKitVoiceGateway` from env (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_PUBLIC_WS`), pass as `RoomDeps.voice`; call `commit(room)` at the end of `flush()`; send sessions to seats (§5.2); `/healthz` reports LiveKit reachability.
- `packages/protocol`: `VoiceGrant.visible?`, `VoiceSession`, `ServerMessage {t:'voice'}`, `createRoom.comms` (§3) — only if the seam proposals are accepted.
- `apps/web`: call `VoiceClient.applySessions` on the `voice` message; render mic/audio-unlock UI; speaking indicators from `VoiceClient` events (§5.4).
- `e2e/harness`: start LiveKit via `packages/voice/tooling` in `globalSetup`; wire capture asserts no seat ever receives a session for a channel it has no grant for.
- Rules (via Human): `channelsFor` emits `visible` and moderator `speak:false`.

## 2. LiveKit for local dev and tests, no global install

`packages/voice/tooling/livekit.mjs` (one file, used by `npm run dev:voice` and by the e2e `globalSetup`):
1. Pinned version `1.13.10` with the sha256 of the source tarball and of the Linux release tarballs recorded in the script.
2. Binary location `<repo>/.cache/livekit/1.13.10/livekit-server` (Foundation's gitignored `.cache/`; fallback `packages/voice/.bin/` if they prefer).
3. Acquire, in order: existing binary → Linux: download release tarball, verify against `checksums.txt` → macOS/other: build from the source tarball with the host Go (≥ 1.26) and **all** Go dirs in-repo (`GOCACHE`, `GOMODCACHE`, `GOPATH`, `GOTMPDIR`, `HOME` → `.cache/go*`, `GOTOOLCHAIN=local`) → if no Go: `docker run livekit/livekit-server:v1.13.10` when Docker is running → otherwise fail with the three options printed. Nothing is written outside the repo; nothing is installed globally.
4. Config rendered from a template: bind 127.0.0.1, ports from env (dev default in the voice range 4300–4399; e2e picks free ports), dev API key/secret, `auto_create: false`, UDP range noted in the README.
5. `start()` waits for the HTTP port and returns `{url, apiKey, apiSecret, stop()}`; `stop()` SIGTERM then SIGKILL; `TMPDIR` in-repo for everything spawned.

## 3. In-person flag

- `createRoom` gets `comms: 'remote' | 'in-person'` (default `remote`), fixed at creation like `mode`; `SeatView` exposes it.
- `Room.grantsFor()` returns `[]` for every seat when `comms === 'in-person'`, before the engine is consulted. So `VoiceGateway` only ever sees empty grants, no token is minted, no LiveKit room is created; text and emotes are unaffected because they do not go through the gateway. Verified pattern: the spike's in-person mode leaves LiveKit rooms empty **[test]**.
- Client: `voice: []` plus `comms: 'in-person'` renders "voice off — talk in the room", mic check skipped, no `getUserMedia` call.
- Enforcement is in `Room`, not in the client and not in the gateway, so a tampered client cannot obtain sessions.

## 4. Test plan for browser full matches with voice

1. **Unit (node:test, no LiveKit):** mapping table = policy table; rotation triggers exactly when a member must leave; `commit` idempotent; in-person ⇒ zero tokens; token claims (room, identity, grants, ttl); FakeBackend call order is shuffled per transition.
2. **Policy suite (Playwright + real LiveKit):** the spike's 52 checks moved to `e2e/voice/policy.spec.ts`, driven through the real server and real `@moonveil/rules` instead of the spike's stand-in; plain and TLS modes; headless-shell Chromium; fake 440 Hz mic; "hears" by `totalAudioEnergy`.
3. **Full matches (Playwright):** 7 and 10 players, moderator and automatic modes, voice on, through a complete match. After every phase change: expected hear-matrix from `channelsFor()` for every seat ⇔ measured energy matrix; roster/speaker visibility ⇔ `visible`; wire capture: no `voice` message carries a session the seat has no grant for. Also: a death mid-phase, a Hunter shot, reconnect of one wolf at night, mic-denied seat, in-person room (zero LiveKit traffic), TLS mode once per CI run.
4. **Budget:** policy suite ~2 min per mode; full match ~5 min per mode. Per PR: unit + policy (plain). Nightly: everything incl. TLS.
5. **Not covered, stated:** real phones, backgrounding, NAT/TURN, >10 players, LAN traffic analysis.

## 5. Seam proposals: resolved (ADR 0004)

1. `visible` bit: not added; derived from `speak` at room entry and kept while present (evidence test for the defense row in `packages/voice/test/gateway.test.ts`). 2. Tokens via a `voice` message: agreed; `sync` returns sessions. 3. Per-flush batching: agreed as the single async `sync`. 4. SDK speaking indicators: agreed; server relay retired when the adapter lands. The original evaluation plan is kept below for the record.

### Original evaluation plan

Each comes as a small reviewable diff plus a failing-then-passing test, so acceptance is evidence-based, not taste.

1. **`VoiceGrant.visible`** — Test: with `FakeBackend`, a ghost and a living night-listener (if `livingHearPublicAtNight`) produce identical grant sets but must map to different `hidden` values; without the bit the adapter either leaks the ghost into rosters or hides the living player (a leak of death). Alternative to compare: channel-name convention. Criteria: protocol change size vs correctness; engine owns "who is visible".
2. **`sessions()` + `voice` message** — Test: a seat whose grant changed receives exactly the sessions for its grants and nothing else (wire capture); tokens never appear in `state`. Alternative: `GET /voice/sessions` authenticated by seat token (no protocol change, second auth path). Criteria: one isolation oracle (wire capture), reconnect simplicity, token TTL handling.
3. **`commit(room)`** — Test: a transition where three seats change grants must produce one rotation decision and one shuffled parallel batch, not three sequential reconciles. Alternative: microtask coalescing inside the adapter. Criteria: determinism in tests, no order correlated with seat order.
4. **SDK-side speaking indicators** — Test: a seat's `VoiceClient` can only observe speaking in rooms it holds sessions for (already shown: villager at night sees none). Measure: indicator latency SDK vs server relay. Criteria: ADR §7 wording; if Foundation keeps the relay, the gateway needs a hidden server participant per room, which I would own.

Process: I open one branch per proposal under `voice-*`, Foundation reviews, Human decides protocol changes through Lead. Build order after the split is confirmed: §2 tooling and §1 server modules with unit tests first (no seam dependency), then client wrapper, then wiring once §5 decisions land, then §4 suites.
