# 0004: Voice seam: response to docs/voice/RECOMMENDATION.md (voice f08bf6c)

Status: foundation's position (2026-10-16), for the voice owner and Lead. Nothing implemented yet; gateway work follows agreement.
Accepted from the recommendation: self-hosted LiveKit OSS (grant d), room per channel, server is the only token issuer, rotation instead of revocation, `auto_create: false`.

## 1. `visible` bit on VoiceGrant: counter-proposal, derive `visible = speak` in the adapter
- The need is real: a ghost in public is listen-only and must be hidden, and a seat that speaks must be visible.
- Every row of the voice policy table is consistent with `visible = speak`:

  | Row | Grants | visible = speak |
  |---|---|---|
  | lobby, day living, defense accused, wolves at night, ghosts in `ghosts` | speak + listen | visible |
  | ghosts in `public`, pending Hunter in `public`, moderator everywhere | listen only | hidden |
  | defense, other living | listen only | hidden |

- **The defense row is the only change from the voice table.** Hiding there leaks nothing:
  - every player knows only the accused may speak;
  - the UI's participant list comes from game state, not LiveKit;
  - a seat that is visible on one step and hidden on the next reveals only the public step change.
- **Why not an explicit bit:** the bit would encode a second secrecy rule in the engine and protocol and need its own tests. Deriving it keeps one source (`speak`). Add the bit only if a row ever needs listen-only-visible or speak-hidden.

## 2 + 3. Tokens and per-flush batching: agree, merged into one async call
- Tokens must not go into `state` views: those are diffed and re-sent whole, and the logs in tests and the harness would capture them.
- Proposed seam, replacing `setGrants` and `closeRoom`:
  ```ts
  interface VoiceSession { channel: string; url: string; token: string; listen: boolean; speak: boolean }
  interface VoiceGateway {
    // Called once per Room.flush() with every seat's FULL current grants ([] = none; in-person rooms: all []).
    // Must apply LiveKit changes (UpdateParticipant, rotation, DeleteRoom) BEFORE resolving.
    sync(room: string, grants: ReadonlyMap<SeatId, readonly VoiceGrant[]>): Promise<ReadonlyMap<SeatId, readonly VoiceSession[]>>;
    // Fresh sessions for one seat on (re)connect, same identity; current grants only.
    sessionsFor(room: string, seat: SeatId): Promise<readonly VoiceSession[]>;
    closeRoom(room: string): Promise<void>;
  }
  ```
- New server message: `{ t: 'voice', gen: number, sessions: VoiceSession[] }`, sent to one seat only.
- **Ordering:** `Room` keeps a voice generation per room and drops a resolved `sync` whose generation is no longer current. A slow mint therefore can't deliver tokens for grants that have since been revoked. The client replaces all sessions on each `voice` message.
- **`gen` doesn't leak:** it counts this seat's own grant changes, not room activity. Same reasoning as `seq` in ADR 0001.
- **Failure:** if `sync` rejects, the server logs it and retries on the next flush; game play continues (text works). Each client is still cut off server-side by the rotation, whether or not it receives the message.

## 4. Speaking indicators from the SDK: agree, for LiveKit
- **Evidence (voice):**
  - With room-per-channel, LiveKit sends speaker updates only for publishers the subscriber receives (`room.go onSubscribeStatusChanged`).
  - Tested: a villager at night sees no speakers.
- **Why it's safe:** the client's tokens are minted only from server grants. So what the SDK shows stays bounded by server policy; this isn't client-side trust.
- **Plan:**
  - The server `speaking` relay (`Room.setSpeaking`, `{t:'speaking'}`) is retired when the LiveKit adapter lands, and ADR 0001 §7 is amended to: "speaking indicators come only from sessions the server issued".
  - Until then it stays as the seam's fallback for a provider without scoped speaker events.
- **Condition:** keep `hidden` for every listen-only session (§1), so a hidden listener never shows as a participant or speaker.

## Other points
- **Mic denial / listen-only:** no server change needed; the client keeps subscribing. Text and emotes stay on Moonveil's protocol, with the same grants (done in foundation-3).
- **In-person rooms** (UI P3, see 0005): every grant set is `[]`, so no sessions are issued.
- **Moderator speaking:** follows the engine grant. Approved Q25 says listen-only, and the rules owner is setting `speaksInPublic: false`.
- **Rotation reconnects** happen only at public, room-wide moments (day/night, a death reveal). Wolves-room rotation follows a wolf's death, which resolves at night close. Nothing new leaks.
- **Traffic analysis** (a wolf's uplink at night) is the same risk class as UI P10; see 0005.

## Who builds what (proposal)
- **Foundation:** seam types, `Room` wiring (generation, `voice` message, reconnect re-issue, in-person `[]`), fake-gateway tests.
- **Voice owner:** `LiveKitVoiceGateway` (rooms, rotation, tokens), and the client voice module that consumes `voice` messages and SDK speaking state.
- **UI owner:** mic button, the "join campfire" tap as the audio unlock, rings from the voice module.

## Update 2026-10-16: visibility, accepted as sticky per room generation (voice owner)
- **Evidence:** `packages/voice/test/gateway.test.ts` "defense (evidence)" (branch `voice`, a0c6be6).
  - Pure `visible = speak` makes the public room rotate twice per defense (start and end), and everyone reconnects both times.
  - The sticky variant keeps already-visible living listeners visible within a room generation. Defense then costs two `UpdateParticipant` calls (`canPublish` off/on) and no rotation.
- **Accepted:** nothing leaks either way. The living listeners in a defense were already visible in that room, and everyone knows the defense rule. Ghosts and the moderator join hidden. A death rotates the room anyway, so a newly dead seat never stays visible.

## Wiring status (foundation-6)
- **Server:** `VoiceGateway` = `sync` / `sessionsFor` / `closeRoom`.
  - `Room` syncs once per flush when the grant map changed; in-person rooms sync `[]`.
  - Each seat gets only its own sessions in `{t:'voice', gen, sessions}`; `gen` counts per connection.
  - Stale async results are dropped; failures are retried on the next flush; `sessionsFor` runs on (re)connect; `closeRoom` on room close.
  - `main.ts` builds `LiveKitVoiceGateway` + `LiveKitBackend` from `LIVEKIT_URL`, `LIVEKIT_PUBLIC_WS`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (all four or none; partial = startup error).
- **Client:** `client.ts` owns the `VoiceClient` (lazy import; created on the first non-empty `voice` message) and applies every `voice` message. Exposed as `client.voice` and `globalThis.__moonveil.voice`. The UI calls `unlockAudio()` / `setMuted()` and reads `subscribe/getSnapshot`.
- **Evidence:**
  - `apps/server/test/voice.test.ts` (recording gateway + the real `LiveKitVoiceGateway` on `FakeBackend`);
  - `npm run e2e:matches:voice`: real LiveKit 1.13.10 built in-repo; 8 browser matches; every `voice` frame only for granted channels; tokens bound to the seat and room; never in `state`.
  - Audio itself (who hears whom) is the voice owner's suite (`packages/voice/e2e`).
- **Not used:** a `MOONVEIL_RULES_CONFIG` phase override. `MOONVEIL_TEST_TIME_SCALE` (or `E2E_TIME_SCALE` for the matches) shortens wall time without touching approved durations. Pick ×5 if audio checks need about 12 s nights.

## Reversal 2026-10-16: sticky visibility withdrawn; `visible = speak` as first written
- **Evidence** (voice owner's measured-audio suite on foundation's wiring; `docs/voice/RECOMMENDATION.md` on `voice`): with sticky visibility, players who died mid-room stayed visible as listen-only participants in the public roster, and living players could see them. Roster hits: 315 and 297 across the two matches. That is a leak (who is dead).
- **Now:** a seat is visible in a room only while it may `speak` there, decided per grant change. A trial costs two short public-room reconnects (start and end of defense); that is the accepted cost.
- **Foundation wiring:** no change needed (grants in, sessions out).
- **Hear-matrix:** 0 failures across 3,175 pair-channel checks (7-seat moderator to the end; 10-seat automatic).
- My earlier acceptance of sticky visibility (update above) was wrong. The test that should have caught it is the roster check across a death, which the measured suite now covers.
