# Voice spike: test results

Suite: `spikes/voice/tests/channels.spec.ts` (Playwright 1.64.1, Chromium 156.0.8078.4 headless, 10 isolated contexts, fake mic = 440 Hz WAV).
Server under test: LiveKit 1.13.10 built from the v1.13.10 source tarball, config `spikes/voice/config/livekit.yaml` (127.0.0.1:4300, TCP 4301, UDP 4310–4350, `auto_create: false`).
Machine: macOS arm64, 11 cores. Wall time 1.3 min. Command:

```
cd spikes/voice && npm test
```

Verified revision: see "Run on SHA" below (the commit containing this file cannot name itself; the docs-only follow-up commit records it).

## Run 3 (2026-10-16, all 43 checks pass)

```
PASS  lobby: wolf hears everyone
PASS  lobby: villager hears everyone
PASS  lobby: mic-denied player still hears everyone
PASS  lobby: mic-denied player connected with a recorded mic error and no published track
PASS  lobby: only the public channel exists
PASS  day: living villager has only the public channel
PASS  day: wolf is connected to wolves channel but it carries no audio
PASS  day: villager hears all living publishers publicly
PASS  night: wolves hear each other on the wolves channel
PASS  night: villager has only the public channel
PASS  night: public channel is silent for everyone
PASS  night: villager sees no speaking indicator anywhere
PASS  night: villager still sees all 9 others in public (no participant-list change)
PASS  night: no public participant exposes an audio track
PASS  night: villager saw identical event signatures for wolves and villagers
PASS  night: all unpublish events arrived within one 1 s burst
PASS  night: forced publish by a villager is rejected by the server
PASS  night: LiveKit shows zero tracks in public after the attack
PASS  night: wolf observes no track from the attacking villager
PASS  death: public channel rotated to a new room (stale tokens die with the old room)
PASS  death: ghost cannot rejoin public with its old living token
PASS  ghost: p04 has public(hidden, listen) + ghosts, never wolves
PASS  ghost: living players do not list p04 in public
PASS  ghost: LiveKit marks p04 hidden in public
PASS  ghost: forced publish into public is rejected
PASS  day2: ghost hears all living publishers in public
PASS  day2: living never hears or lists the ghost
PASS  day2: ghost sees living speaking indicators
PASS  dead wolf: p01 now has ghosts + hidden public, no wolves channel
PASS  dead wolf: remaining wolves no longer see p01 in wolves
PASS  dead wolf: stale wolves token is rejected after removal
PASS  forged token (wrong secret) is rejected
PASS  token binds the room name; client cannot pick another room
PASS  night2: remaining wolves hear each other
PASS  night2: ghosts hear each other on ghosts
PASS  night2: ghosts have no wolves channel and hear nothing public
PASS  night2: living hear nothing from ghosts or wolves
PASS  night2: living wolf hears nothing from ghosts
PASS  reconnect: wolf reloads, gets wolves again and hears the other wolf
PASS  reconnect: LiveKit has exactly one p03 in wolves
PASS  in-person: every client has zero voice channels
PASS  in-person: LiveKit rooms are empty
PASS  in-person -> remote: voice resumes with the same entitlements
```

## Earlier runs
- Run 1: 32/33 pass. FAIL "stale wolves token is rejected after removal": OSS LiveKit ignores `revokeTokenTs`; the removed wolf rejoined the wolves room with its cached token. Led to channel rotation (see RECOMMENDATION.md).
- Run 2: 42/43 pass. FAIL was a test bug (asserted the pre-rotation room name).

## How "hears" is measured
Inbound RTP `totalAudioEnergy` (via `RemoteAudioTrack.getReceiverStats()`) must grow by more than 0.004 over a 2 s window. A -12 dBFS tone yields about 0.06; silence or no track yields 0. Participant lists, speaker lists, track lists and the event log come from `livekit-client` room state in each context; LiveKit's own view comes from `ListParticipants` through the spike server (`/api/rooms`).
