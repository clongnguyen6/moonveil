# Voice: test results

## Browser full-match suite (`packages/voice/e2e`, product code on foundation's wiring, 2026-10-16)

Command: `E2E_PORT=4350 node scripts/env.mjs npm run e2e -w @moonveil/voice` (web build, pinned LiveKit 1.13.10 on 4360/4361 + UDP 4370–4399, real-engine server with `MOONVEIL_TEST_TIME_SCALE=3`; headless-shell Chromium, fake mic = speech-like bursts, one context per seat; foundation's harness).

**Measured hear-matrix** (received audio energy per channel and remote seat, 2 s window after every step, compared with the matrix derived from each seat's own `state.voice` grants: A hears B on c ⇔ A.listen(c) ∧ B.speak(c) ∧ B's mic granted):

| Match | Steps measured | Pair-channel checks | should-hear failures | must-not-hear failures |
|---|---|---|---|---|
| moderator, 7 seats + moderator, complete match (run 4) | 26 (lobby, 4 full day/night cycles with defense + confirm, ended) | 1,960 | 0 | 0 |
| automatic, 10 seats, real timers ×3, 4 min budget (run 3) | 15 (lobby → 3 nights, 2 defenses, confirm, hunter); 1 skipped (grants changed mid-window) | 1,215 | 0 | 0 |

**Token / channel checks (separate from the audio measurement), all pass in runs 3–4:** every page holds exactly the channels of its grants, each connected; rosters contain only granted seats and never a listen-only one; every `voice` frame carries only channels the seat is granted at that moment, with `speak` never beyond the state grant; LiveKit's own participant list shows the moderator hidden while listen-only and visible at `ended` (engine grants everyone public speak then); in-person room: no sessions in any `voice` frame, no LiveKit room for the code, no voice channel in any page, public text delivered in the lobby.

History of this suite: run 1 (steady 440 Hz tone) measured ~1/40 of the expected energy for every should-hear pair (noise suppression on the product mic treats a constant tone as noise; 0 must-not-hear failures) → speech-like bursts. Run 2: hearing 0/0 failures, but 315 + 297 roster hits: listen-only seats visible in the public roster (sticky visibility: seats that died mid-room stayed visible) → adapter switched to the literal ADR rule, visible iff speak. Run 3: 0 hear-matrix failures; one false assertion of mine (moderator expected hidden at `ended`) fixed → run 4 green.

Not covered here: real devices, NAT/TURN, >10 seats, TLS in this suite (the spike covers TLS), timing/traffic side channels.

## Spike suites (`spikes/voice/tests/`)

Suites (`spikes/voice/tests/`): `channels.spec.ts` (approved channel policy, 11 sessions: 10 players + hidden listen-only moderator, 52 checks) and `secure-context.spec.ts` (3 tests). Playwright 1.64.1 with full Chrome for Testing 156.0.8078.4 from `spikes/voice/.browsers`, headless, one isolated context per seat, fake mic = generated 440 Hz WAV. Browser `HOME` and `TMPDIR` point into `spikes/voice/.tmp`.

Server under test: LiveKit 1.13.10 built from the v1.13.10 source tarball; config `spikes/voice/config/livekit.yaml` (127.0.0.1:4300, ICE/TCP 4301, UDP 4310–4350, `auto_create: false`). TLS mode adds `tls-proxy.mjs` on 4303 with a throwaway certificate trusted only by SPKI pin inside the test browser.

Commands:
```
cd spikes/voice && npm test          # plain: browsers use http://127.0.0.1:4302 and ws://127.0.0.1:4300
cd spikes/voice && npm run test:tls  # TLS:   browsers use https://camp.local:4303 and wss://camp.local:4303
```

## Run on SHA
- Branch `voice`, commit `2cc4766` (merge of `origin/dev` 013206a into voice): run 11 TLS and run 11 plain, 4/4 tests, 52/52 checks each, ~1.9 min each, ports 4300–4399 free afterwards. The commit adding this line is docs-only.
- Also 4/4 and 52/52 in both modes on a56fd41 (merge of dev 1e4a300; runs 10).
- Same results on 548c985 (plain) and on 5f23e52's working tree (runs 8 plain and TLS).

## Checks (2026-10-16, runs 8 plain and 8-TLS, all PASS in both modes; ~1.9 min each)

```
PASS  lobby: wolf hears everyone
PASS  lobby: villager hears everyone
PASS  lobby: mic-denied player still hears everyone
PASS  lobby: mic-denied player has a recorded mic error and no published track
PASS  lobby: players have only the public channel
PASS  moderator: hears public, is hidden, publishes nothing
PASS  moderator: players never list the moderator
PASS  moderator: forced publish is rejected by the server
PASS  day: living have exactly the public channel (no wolves room by day)
PASS  day: villager hears all living publishers
PASS  night: living villager has no voice channel at all
PASS  night: wolves have exactly the wolves channel
PASS  night: wolves hear each other
PASS  night: wolves do not see the moderator in their room
PASS  night: moderator hears the wolves
PASS  night: LiveKit public room holds nobody but the hidden moderator
PASS  night: villager saw only leave-type events at nightfall, one identical signature for everyone it saw
PASS  ghost: p04 has ghosts + hidden listen-only public, never wolves
PASS  ghost: LiveKit marks p04 hidden in public and visible in ghosts
PASS  ghost: ghosts do not see the moderator
PASS  moderator: listens on all three channels
PASS  ghost: forced publish into public is rejected
PASS  day2: ghost hears all living publishers in public
PASS  day2: living never list or hear the ghost
PASS  day2: living have no ghosts channel
PASS  day2: moderator hears public
PASS  day2: LiveKit wolves room holds nobody but the hidden moderator (wolves not connected by day)
PASS  defense: accused publishes in public
PASS  defense: other living hear only the accused
PASS  defense: other living cannot publish (server rejects a forced publish)
PASS  defense: LiveKit shows exactly one published track in public, the accused one
PASS  defense: ghost and moderator hear the accused
PASS  dead wolf: p01 has ghosts + hidden public, no wolves channel
PASS  forged token (wrong secret) is rejected
PASS  token binds room, identity and grants (client cannot choose a room)
PASS  night2: remaining wolves hear each other
PASS  night2: dead wolf is gone from the wolves room
PASS  night2: dead wolf cannot reuse its night-1 wolves token (room rotated, auto_create off)
PASS  night2: ghosts hear each other on ghosts
PASS  night2: ghosts have no wolves channel and public is silent for them
PASS  night2: living villager has no channel; living wolf has no ghosts channel
PASS  night2: moderator hears wolves and ghosts
PASS  hunter pending: only hidden listen-only public, no ghosts channel
PASS  hunter pending: ghosts do not see the hunter in the ghost room
PASS  hunter pending: forced publish into public is rejected
PASS  hunter resolved: joins ghosts and hears a ghost
PASS  hunter resolved: ghosts now see the hunter
PASS  reconnect: wolf reloads at night, gets wolves again and hears the other wolf
PASS  reconnect: LiveKit has exactly one p03 in wolves
PASS  in-person: every seat (incl. moderator) has zero voice channels
PASS  in-person: LiveKit rooms are empty
PASS  in-person -> remote: voice resumes with the same grants
```

Secure-context tests (both modes): insecure LAN-style origin has no `navigator.mediaDevices`; untrusted certificate is refused (`net::ERR_CERT_AUTHORITY_INVALID`); pinned certificate gives secure context, microphone, LiveKit over `wss://` and audio energy between two players.

## How "hears" is measured
Inbound RTP `totalAudioEnergy` (via `RemoteAudioTrack.getReceiverStats()`) must grow by more than 0.004 over a 2 s window. A -12 dBFS tone yields about 0.06; silence or no track yields 0. Participant lists, speaker lists, track lists and the event log come from `livekit-client` room state in each context; LiveKit's own view comes from `ListParticipants` through the spike server (`/api/rooms`).

## History
- Runs 1–6 (first channel model, 43 checks): run 1 found that OSS LiveKit ignores `revokeTokenTs` (stale wolf token re-entered the wolves room) → channel rotation; run 2 fixed a test bug; runs 3–6 all pass; run 6 on a94fe73.
- Run 7 (TLS): proxy told browsers the wrong `wss://` host (Host header rewritten by the proxy) → fixed with `x-forwarded-host`; LibreSSL signed the throwaway certificate with SHA-1 → `-sha256`.
- Run 8: suite rewritten to the approved policy (no grant = not connected; defense; pending Hunter; moderator). The first attempt's nightfall uniformity check was too strict: when the public room closes, a villager may see some participants leave before its own disconnect, in LiveKit's room-close order. The check now requires leave-type events only and one identical signature for everyone seen.
