# 0005: Response to docs/ui/PROPOSALS.md (game-ui d0579db)

Foundation's position (2026-10-16). "Done" = on branch foundation-4, with tests in `apps/server/test/ui-proposals.test.ts` unless noted.

| # | Proposal | Response |
|---|---|---|
| P1 | `moderate` message | **Already provided, no new type.** The moderator seat's `act` goes to `engine.moderate` (foundation-3). Send `{t:'act', action:{type:'step.close' \| 'day.confirmCount' \| 'player.remove' \| 'match.abort', …}}`. `advance` stays as a shortcut for step close. One route; the server picks it by seat kind. |
| P2 | text chat | **Provided in foundation-3, with these differences:** C→S is `say` (not `chat`). S→C live is `chat {channel, msg}`. History is per channel: `chatlog {channel, messages}`, sent whenever a connection gains `listen` on a channel, not once per attach. This is how a pending Hunter gets ghost history only after resolution. Rejection is an `error` (`not-allowed`, `rate-limited`) to the sender only; it leaks nothing, since the sender knows its own grants. **Added now:** `msg.name` (sender's name at send time); limit 500. |
| P3 | voice mode | **Done.** `create {…, voiceMode?: 'remote' \| 'inPerson'}` (default remote), `SeatView.voiceMode`. In-person rooms send `[]` grants to the voice gateway, so no sessions ever. Text, game and grants are unchanged. Not changeable after creation (ask if a lobby toggle is wanted). |
| P4 | speaking | **Provided** (`{t:'speaking', seats}`, filtered by listen grants). With LiveKit, indicators move to the SDK inside server-issued sessions (ADR 0004 §4); the relay stays until then. |
| P5 | `phaseStartedAt` | **Counter-proposal, done:** `SeatView.phaseDurationMs` (static per phase) plus server `now` on every `state` and `hb` frame (outside the diffed view). Ring = `(phaseEndsAt − serverNow) / phaseDurationMs`; `Client.serverNow()` applies the skew. Why not a start time: after a pause/resume the start time is wrong, while the deadline and duration stay exact. A per-flush remaining time would also make every flush produce a new frame for every seat, a timing channel on hidden actions. |
| P6, P7 | rules items | Done by rules (dev 58abc9e). Server tests: `approved-rules.test.ts`. |
| P8 | typing | **Done:** `@moonveil/rules` declared in `apps/web/package.json`. **Counter on typing `SeatView.game` as `HostView \| null`:** the fixture engine still serves browser e2e, so that type would lie. Use `gameView(view)` (narrows on `view.engine === 'moonveil-werewolf'`) and the `GameView` / `PlayerAction` / `ModeratorCommand` types. Revisit when the fixture leaves browser e2e. |
| P9 | shell handoff | Ownership already moved (App.tsx, styles.css, provisional/ → UI owner). `Client` now exposes `chat`, `speaking`, `voiceMode`, `serverOffsetMs` in state, plus `onPoses(fn)` and `serverNow()`, so the `Session` adapter is a thin wrapper. |
| P10 | traffic padding | **Counter-proposal: not now; a bundle once TLS exists.** Reasons below. |

## P10 analysis
- **Leak surface on the wire, during secret phases:**
  - Upstream: `act` frames only from acting seats.
  - Downstream: frames only to entitled seats (wolves get pack picks; the Seer gets their own result).
  - Voice: a wolf's uplink carries audio at night (voice owner's note).
  - Sizes: snapshots differ by role at any time (a wolf's view includes `pack`).
- **Client no-op cadence alone fixes only upstream timing.** Downstream timing, sizes and voice remain.
- **Without TLS** (plain `ws://` on LAN, ADR 0002 option A), payloads are readable JSON to anyone who can capture the traffic, so padding is moot. Treat TLS as step 1; it's an open decision (0002).
- **Proposed bundle once TLS is chosen (foundation, client + server):**
  - During secret phases, every connection gets exactly one frame per 1 s tick, padded to a fixed size bucket, carrying the latest view or filler.
  - Clients send one fixed-size frame per tick (a queued act or a no-op).
  - All snapshots are padded to size buckets in every phase.
  - **Cost:** about 8 KB/s per client at night (128 KB/s at 16 players); night actions take up to 1 s longer to show.
  - **Test:** in every window, every seat's wire has equal frame counts and sizes.
- **Voice uplink** needs constant-bitrate silence from every living seat at night. Feasibility in LiveKit/Opus is unverified; that's the voice owner's to investigate.
- **Until then** ADR 0001's accepted risk stands (traffic analysis by a network observer). The decision belongs with HTTPS (0002).

## docs/visual/POSES.md (visual): adopted, with one counter
- **Adopted (foundation-4):**
  - integer world units with x −200…1900, y −200…1600, `facing` 1 | −1;
  - lobby moves checked with `isWalkable(createMap(playerCount))`, ghost moves with `inWorld`;
  - map recreated when the lobby count changes; rates unchanged.
- **Counter:** no speed/teleport plausibility check. It protects no secret (positions are public in the lobby, ghost-only during play), and bunched packets after network jitter would make it drop legitimate moves. Add it only if cosmetic cheating becomes a real problem.
- **Moderator poses:** the moderator follows the ghost listen grant, so ghost poses during play (approved: listen-only on every channel), plus everyone in the lobby.
