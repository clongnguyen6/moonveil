# ADR 0001: Stack, authority and information isolation

Status: accepted for the foundation increment (2026-10-16). Open items at the end. Owner: foundation.

## Context
Server-authoritative social-deduction game. 7–10 players typical, more desirable. Phones and laptops. Secrets (roles, night actions, targets, group membership, ghost activity) must not reach unentitled clients through payloads, presence, or foreseeable timing. Moderator and automatic modes run on one core. Rules come from a separate pure engine (packages/rules, not yet published). Voice provider is undecided. Local only.

## Decisions
1. **TypeScript end to end. npm workspaces. Node ≥ 24.12 runs server `.ts` directly.**
   Node docs: type stripping is on by default and "now stable" from v24.12.0. Only erasable syntax is allowed (no enums, parameter properties or runtime namespaces), `.ts` extensions are required, and TS files under `node_modules` are refused. Workspace packages are symlinked, so they resolve outside `node_modules`; verified by running the server. Tsconfig follows the Node-recommended flags, plus `allowImportingTsExtensions`.
   npm, not pnpm: npm ships with Node, and a project `.npmrc` keeps its cache in-repo. `scripts/env.mjs` points every cache and tmp dir (npm, Playwright browsers, TMPDIR, XDG) at `.cache/`.
2. **Transport: one Node HTTP server plus a raw WebSocket at `/ws` (`ws` 8), with JSON frames. Inbound messages are validated by zod (`packages/protocol`).**
   Colyseus was rejected. Its docs say: "By default, the entire state is visible to all clients", and filtering is opt-in per field via `@view`/`StateView`. A single missed tag leaks a secret, which is the wrong default here. The docs also warn "Avoid relying on StateView for large datasets".
   Socket.IO was rejected. Room broadcast is its easy path, which is the leak path for us. Its connection-state recovery restores id, rooms and data but "will not always be successful", so we would need app-level resume anyway. That leaves little gain at ≤ 20 sockets per room.
   The `ws` docs' ping/pong heartbeat and `noServer` upgrade pattern are used as written. Same-origin is checked on upgrade.
3. **Per-seat snapshot is the only egress.** Each connection gets `state{seq, view}`, where `view = shell public data + engine.view(state, viewer)`. It is sent only when that seat's JSON differs from the last one sent. `seq` counts per connection, never per room. Acks and errors go to the actor only.
   Side channels handled:
   - A hidden action produces zero frames for unentitled seats.
   - Published presence is frozen for players during secret phases. The moderator sees it live.
   - Automatic mode never closes a secret phase early: a fixed deadline from `PhaseInfo.durationMs`.
   - Voice grants are server-derived.
   Not handled (accepted for now):
   - Traffic size and analysis on a shared LAN.
   - Moderator timing.
   - Physical cues in the room.
4. **Identity and reconnect.** Join issues a 192-bit seat token. It is kept in `localStorage` per room code and sent in a `resume` message, never in the URL. The newest connection for a seat wins, and the old one gets `bye: replaced`. Reconnect gets the same projection, so it can't grant more knowledge than the seat already had.
   Chrome's Page Lifecycle docs say frozen pages don't run timers and pages may be discarded under resource pressure. So the client survives a full reload, reconnects on `online`/`visibilitychange`, and runs a watchdog on the app heartbeat `hb`, because browsers can't see WS pings.
5. **Modes on one core (`Room`). Mode is fixed at creation.**
   - `moderator`: the creator is a non-playing moderator seat, uses viewer `moderator` and advances phases manually.
   - `automatic`: the creator is a player with host powers in the lobby only (start). It uses viewer `seat` and gets no secrets. A server timer advances phases.
6. **Rules hosting.** `apps/server/src/rules/engine.ts` defines `RulesEngine<S>`, mirroring `@moonveil/rules` `host.ts` (API v0.3).
   - Methods: setup(seed), phase, submit, moderate, remove, advance, sync/tick/pause/resume/timer(now), view(viewer incl. public), channels(seat|viewer).
   - Pure: time enters only as `now`; the automatic-mode clock lives in engine state.
   - `main.ts` serves `createRulesEngine()`. `MOONVEIL_ENGINE=fixture` serves the stub, used by browser e2e until the real-game UI exists.
   - `test/rules-engine.test.ts` checks at compile time that the real engine satisfies the contract with no cast.
   - New workspace packages: the owner adds its entry and an add-only lockfile delta (via `scripts/env.mjs`) in the commit creating the package; it must pass root `npm run check`.
   - Server policy on top of the engine:
     - Automatic mode: after every change `sync`, then wake at `timer().deadline` and `tick`. `phaseEndsAt` = deadline (null while paused).
     - Approved pause rule: `pause` while all player seats are disconnected, `resume` when any player is back. Automatic rooms have no moderator seat.
     - Never close a secret phase early, even if the engine reports `earlyClose`. Public early close (engine: Hunter step only) after `EARLY_CLOSE_GRACE_MS` (1.5 s).
     - Moderator mode: no timers. The moderator's `act` → `moderate` (incl. `day.confirmCount`, `step.close`).
     - `remove` (long-disconnect policy) is unused; policy open.
   - Chat and movement use the same grants:
     - Text (`say`) is accepted only with `speak` on the channel and delivered live only to current `listen`ers.
     - A channel's history (`chatlog`) is sent when a connection gains `listen` on it, incl. on connect. This filter at read time covers the pending Hunter and reconnect.
     - Message ids are random.
     - Speaking indicators are re-published per viewer, filtered by `listen`, and only for speakers that still hold `speak`.
     - Poses: lobby, everyone. Play: only seats with `listen` on `ghosts` move and see poses (ghosts, moderator). Living seats get no pose frames; nothing after the end.
7. **Voice seam.** `apps/server/src/voice.ts` defines `VoiceGateway.setGrants(room, seat, grants)`, and the seat sees its own grants in `view.voice`. A provider adapter must:
   - mint tokens only from server grants,
   - revoke them on change,
   - not expose cross-channel rosters,
   - re-publish speaking indicators per seat through the server. (Proposed change with LiveKit: SDK indicators inside server-issued sessions, see 0004.)
8. **Web shell: Vite + React 19, mobile-first.** The game renderer belongs to the visual scope. `apps/web/src/provisional/` holds only the fixture UI.
9. **Tests.**
   - `node:test` server tests use an in-process harness with a manual clock, plus a real-socket test on 4120.
   - The Playwright harness (`e2e/harness`) gives one BrowserContext per player. Playwright docs say contexts are "completely isolated, even when running in a single browser".
   - Every received WS frame is captured, so isolation is asserted on the wire, not the UI.
10. **Ports.** Server 4100 (dev), Vite 4101, server tests 4120, e2e 4150. The server binds 127.0.0.1 by default; `HOST=0.0.0.0` opens it to LAN phones.

## Open (challenge welcome)
- **LAN phones and voice need HTTPS.** MDN: `getUserMedia` is secure-context only (`navigator.mediaDevices` is `undefined` otherwise). Only https, localhost and 127/8 count as secure, so a LAN IP over http does not. Phones on LAN need local TLS with a cert they trust. Not built. Needs a decision with the voice scope.
- Presence freeze during secret phases: players can't see who dropped at night.
- Ghost, dead-player knowledge and channels: engine-defined. The shell carries whatever `view`/`channels` return.
- Moderator ≠ creator, mode switch in lobby, moderator handoff: not supported.
- Restart recovery: rooms persisted to `.data/rooms` and restored on boot (0003). The host operator can read secrets on disk and in memory.
- One seat per browser profile per room. Two players on one device is unsupported.
- Player cap is the engine's `maxPlayers` (fixture: 3–20). Larger rooms are untested.
- Traffic analysis (timing/size padding, voice uplink): deferred until TLS is decided; proposed bundle in 0005 P10.
