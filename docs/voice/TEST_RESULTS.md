# Voice: test results

## Browser full-match suite (`packages/voice/e2e`, product code on foundation's wiring)

Command: `E2E_PORT=4350 node scripts/env.mjs npm run e2e -w @moonveil/voice` (web build, pinned LiveKit 1.13.10 on 4360/4361 with multiplexed UDP 4370–4399, real-engine server with `MOONVEIL_TEST_TIME_SCALE=2`; headless-shell Chromium, fake mic = speech-like bursts, one context per seat; foundation's harness).

### Run 10 (2026-10-16 20:50–21:10, heavy-run lock held; test files at d2815dd, product code identical to 7bc0be9)

Conditions (sampled every 30 s into `.cache/voice-e2e/conditions-run10.log`): load average 6.9 at start, peak 27.8 (0.3 % CPU idle) at 21:06, 12.9 at end; memory 35 GB of 36 GB used throughout, 12–15 GB in the compressor. The load came from other projects on the shared machine, not from Moonveil test processes.

**Measured hear-matrix** (received audio energy per channel and remote seat, 2 s window after every step, versus the matrix derived from each seat's own `state.voice`: A hears B on c ⇔ A.listen(c) ∧ B.speak(c) ∧ B's mic granted):

| Match | Steps measured | Pair-channel checks | should-hear failures | must-not-hear failures | Windows skipped |
|---|---|---|---|---|---|
| moderator, 7 seats + moderator, complete match to `ended` (9.1 min) | 11 (lobby, 2 nights, 1 day with vote/defense/confirm, Hunter, ended) | 658 | 0 | 0 | 0 |
| automatic, 10 seats, real timers ×2, 5 min budget (8.1 min) | 4 (lobby, night.main, day.discussion ×2) | 369 | 0 | 0 | 4 |

The 4 skipped windows are all whole-table step boundaries: in each, every page moved from the same step to the same next step during the 2 s window (day.vote → night.main twice; night.witch → day.discussion; night.witch → hunter), i.e. a timer-driven step closed while measuring. No window showed per-page skew (pages on different steps). Evidence lines are in the run log (`skipped <step>: … pages that differ/changed: …`).

**Token / channel checks (separate from the audio measurement), all pass:** every page holds exactly the channels of its grants and each is connected; rosters contain only granted seats and never a listen-only one; every `voice` frame carries only channels the seat is granted at that moment, with `speak` never beyond the state grant; LiveKit's participant list shows the moderator hidden while listen-only and visible at `ended`; in-person room (1.7 min): no sessions in any `voice` frame, no LiveKit room for the code, no voice channel in any page, public text delivered in the lobby.

### Slot 17 (2026-10-17 14:35–, lock held; candidate 1d12fc6 = d85b133 + dev 36bdafd): A/B and run 17, FAILED; cause found by measurement

Kept: `.cache/voice-e2e-ab17-off.log`, `.cache/voice-e2e-ab17-on.log`, `.cache/voice-e2e-run17.log`, per-run artifacts `.cache/voice-e2e/results-ab17-off/`, `results-ab17-on/`, `results-run17/` (error contexts + traces), `.cache/voice-e2e/conditions-slot17.log`, `conditions-ab17-off.log`, `conditions-ab17-on.log`, LiveKit server log `.cache/voice-e2e/livekit.log`.

Root check on 1d12fc6 (load 2.7): rules 206, scene 20, voice 50, server 91, e2e 13/13.

**A/B, same test files, `MOONVEIL_TEST_SEED=voice-ab!`, scale 2, back-to-back:**
- revoke **off**: moderator and automatic both failed: "Ann: page unresponsive, voiceSnapshot did not return within 15000 ms", "Chi: … voiceStats …".
- revoke **on**: moderator measured 1 window (night.main#0, 35 checks, 0 failures; settle evidence: Ann's wolves room `connecting` → `connect timed out after 20000 ms` → `connecting` again), then the browser was closed at the test timeout; automatic: "Bao: page unresponsive".
- Conclusion: **revoke-before-delete is not the distinguishing factor**; both variants fail the same way. The `VoiceClient` publish-hang fix (d85b133) did not make the full matches pass either; it holds only what its unit test shows (a stuck publish no longer blocks applying sessions). Conditions during the A/B: load 1-min peak 78 (0.5–0.8 % idle), 35 GB used, 15 GB in the compressor, <130 MB free, swap-ins/outs in the millions.

**Cause, measured live during run 17 (three samples 5 s apart):** the headless browser's **GPU process at 624–728 % CPU** (`--use-angle=swiftshader-webgl`: software WebGL), each of the 11 page renderers at 5–14 %. Every page mounts the camp scene (`apps/web/src/ui/SceneMount.tsx` → `@moonveil/scene`, pixi.js 8, WebGL); 11 software-rendered scenes take 6–7 of the machine's 11 cores, on top of other projects' load and heavy memory pressure. That starves everything in the browser at once: `page.evaluate` (the new 15 s bound turns the starvation into a named failure where the old unbounded harness simply waited), ICE (`could not establish pc connection`, `short ice connection`), mic publishes (run 16's one seat with a single publish event). It also explains the history: the scene entered the web shell on 2026-10-16 ~18:15–21:00 and grew (textures, visual-5); runs 8–10 predate it, run 11 and 13 passed partially on an earlier scene, runs 15–17 fail. No renderer spins, so a client-side busy loop (hypothesis 1) is ruled out by the per-process numbers; what the renderers do during the 15 s is wait for CPU.

**Mitigation for this suite (test-only, `packages/voice/e2e`):** pages get an init script that never fires `requestAnimationFrame`, so the scene's frame loop does not run (`VOICE_E2E_SCENE=on` restores it). The suite measures audio, not visuals. To be verified in the next slot, with the GPU-process CPU sampled before/after.

**Product note for the game-UI/visual owners (not my scope):** the scene renders at full rate in every page regardless of `document.hidden` or reduced motion; pausing the ticker for hidden pages and under `prefers-reduced-motion` would save CPU/battery on phones too. Reported through Lead.

### Runs 15–16 (2026-10-17 12:33–13:24, window + lock; candidate 7320503 = 2f38c5f + dev 5b081c4): FAILED, under analysis

First full run with revoke-before-delete (70d5bb2). Kept artifacts: `.cache/voice-e2e/keep/voice-e2e-run15.log`, `.cache/voice-e2e/keep/voice-e2e-run16.log`, `.cache/voice-e2e/keep/run16-results-final/` (run 16 error context + trace), `.cache/voice-e2e/livekit.log` (append-only server log covering runs 10–16), `.cache/voice-e2e/conditions-run15.log`. Run 15's own Playwright artifacts were lost: Playwright wipes `outputDir` when the next run starts, and run 16 started in the same chain; artifact directories are now per run (`VOICE_E2E_RUN`).

| Run | Match | Conditions (load 1-min start / peak / end; idle at peak) | Result |
|---|---|---|---|
| 15 | moderator, 7 + mod, scale 2 | 4.0 / 24.0 / 16.7; 0 % idle | 1 window measured (night.main#0: 35 checks, 0 failures), then stuck inside `voiceSettled` until the 12-min test timeout; a `page.evaluate` was still pending when Playwright closed the browser |
| 15 | automatic, 10 seats, scale 2 | same window | "Ann: voice settle" after 40 s (channels never matched grants) |
| 15 | in-person | same window | pass (1.5 min) |
| 16 | automatic, 10 seats, real time, 10-min budget | 10.0 / 17.6 / 12.9; 1.6 % idle | 3 windows: night.main skipped (whole-table step change), day.discussion 18 checks 0 failures, night.main 99 checks 0 failures; at day.discussion one page (Ivy) had no subscribed track from any of 9 speakers; then "Bao: publishing" never became true until the 18-min test timeout |

**Analysis so far (evidence, not conclusion):**
- LiveKit server log, every rotation in runs 15/16: `ListParticipants`, N × `RemoveParticipant` (all N participants closed with `SERVICE_REQUEST_REMOVE_PARTICIPANT`), `DeleteRoom` ~10 ms later, `CreateRoom` of the next generation; every seat of each new generation joins and becomes active; zero stale-token join errors, zero duplicate-identity events; "2 RTC sessions per seat per generation" is identical in the healthy runs 10–14. The server-side rotation therefore behaves; nothing points at `RemoveParticipant` breaking reconnects.
- Server log, run 16 room `BET4EW-public-g3`: nine seats show two track-publish events, one seat (`s_49b0643a1e`) only one: one browser's microphone publish never completed. In `VoiceClient` (code at 70d5bb2) the mic publish was awaited inside the same promise chain that applies new sessions, with no timeout (livekit-client's `publishTrack` waits for the server's acknowledgement), so one stuck publish freezes that page's voice state: later `voice` messages are never applied, channels no longer match grants, and the page never settles. This matches both run 15 symptoms and run 16's "publishing"/"hears nobody" symptoms. The same "Ann: voice settle" signature appeared in run 11 on product code without 70d5bb2.
- Fix applied to `VoiceClient` (next candidate): mic capture and publish bounded (10 s each), detached from session application, retried with backoff while the channel still grants speak; a dropped channel discards a late track. Unit-tested against the fake Room.
- Still open, needs the A/B under one lock slot (`packages/voice/e2e/ab.sh`: same test files, same `MOONVEIL_TEST_SEED`, same scale, back-to-back, conditions recorded; the only difference `VOICE_REVOKE_ON_CLOSE=0|1`): whether revoke-before-delete changes anything observable on the page side. A green rerun does not cancel runs 15/16; both stay recorded here.

### Runs 11–14 (2026-10-17 03:03–04:08, heavy-run lock held; dev merged at ca23197): real-time follow-up

Purpose: strengthen automatic-mode audio evidence (`MOONVEIL_TEST_TIME_SCALE=1`, `VOICE_E2E_AUTO_BUDGET_MS=600000`). Conditions sampled every 30 s (`.cache/voice-e2e/conditions-run11.log`); the load came from other projects on the shared machine (two long-running Python jobs, an iOS Simulator with ~200 processes, a Codex session), plus one Moonveil CPU job (`apps/server/test/seed-search-zero.ts`, ~100 % of a core, 03:09–03:40).

| Run | Match | Conditions (load 1-min: start / peak / end; CPU idle at peak) | Steps measured | Pair-channel checks | should-hear failures | must-not-hear failures | Skipped windows |
|---|---|---|---|---|---|---|---|
| 11 | moderator, 7 + mod, complete match, real time (10.6 min) | 3.4 / 17.6 / 12.9; 1.5 % idle | 14 (lobby, 2 full day/night cycles with vote, defense, confirm, ended) | 924 | 0 | 0 | 0 |
| 11 | automatic, 10 seats, real time | 12–15; 2–6 % idle | — | — | — | — | failed before measuring: a seat's voice channels did not settle within 40 s after the first rotation; LiveKit logged 8 "short ice connection" events for public-g8 in the same minute |
| 12 | automatic, 10 seats, real time | 13–16; 1.5 % idle | — | — | — | — | my error: fixed 12-min test timeout shorter than the 10-min budget plus seating; no summary printed. Fixed (timeout derived from budget, per-window progress lines) |
| 13 | automatic, 10 seats, real time (13.4 min) | 14.2 / 16.3 / 13.7; 2.5–6 % idle | 9 (lobby, night.main ×2, night.witch, day.discussion ×2, day.vote ×2, day.defense) | 693 | 1 | 0 | 1 (night.witch → day.discussion, all pages moved together) |
| 14 | automatic, 10 seats, real time | 13.1 / **78.8** / 61.9; 2 % idle at start | 2 | 117 | 17 (one window) | 0 | 1; then the test hit its 18-min timeout and Playwright closed the browser; LiveKit logged 1,804 warnings in 8 min. Not usable as evidence either way. |

Per-step counts, run 11 moderator: not printed by that version of the suite (totals only); run 13 automatic: lobby 90, night.main 18, night.witch 90 (1 fail), day.discussion 90, day.vote 90, night.main 18, day.discussion 99, day.vote 99, day.defense 99.

**The one run-13 failure, with evidence, not dismissed:** "night.witch: Gia should hear Ann on public, energy 0.0000". A living seat has public `speak` only by day, so the grants in that window were day.discussion grants while the window carried the label read at the start of the loop iteration (night.witch, a 20 s step). The step had changed during the settle wait; all pages agreed on the new step, so the guard passed; the listener had no subscribed track from the speaker 4.5 s after the rotation under 2–6 % idle CPU. Two suite changes followed (58ec82c): the window is labelled with the step at measurement time, and settling now waits for publishing and for every expected speaker track to be subscribed (bounded 15 s) before the 2 s window. Whether the failure reproduces under lower load is **unresolved**: run 14, meant to answer it, ran into load 55–79 and was killed by its timeout. To be retried when the machine allows.

**Token / channel checks:** all pass in runs 11 and 13 wherever reached (channels = grants, rosters, `voice` frames, moderator hidden/visible rule).

Not covered here: real devices, NAT/TURN, >10 seats, TLS in this suite (the spike covers TLS), timing/traffic side channels.

### Earlier runs of this suite (same day)

- Run 1 (steady 440 Hz tone): ~1/40 of the expected energy on every should-hear pair, 0 must-not-hear failures → speech-like bursts (noise suppression on the product mic treats a constant tone as noise).
- Run 2: hearing 0/0; 315 + 297 roster hits = listen-only seats visible in the public roster (sticky visibility kept seats that died mid-room visible) → adapter switched to the literal ADR 0004 rule (visible iff speak).
- Run 3: 0 hear-matrix failures (1,050 + 1,215 checks); one false assertion of mine (moderator expected hidden at `ended`) fixed. Run 4: moderator complete match 1,960 checks, 0 failures, 0 skipped.
- Runs 5–9 under load averages 10–28 from other projects: should-hear failures only in windows mixing two steps across pages (frames lagging per page), ICE "could not establish pc connection" for the moderator's rooms, one 12-minute test timeout. Changes: tolerant driver, 45 s expect timeout, time scale 2, `VoiceClient` connect timeout + retry, multiplexed UDP ports, cross-page step-consistency guard with skew evidence. Run 8 (moderator alone, 0099957): 896 checks, 0 failures, 0 skipped.

**Known limitation (Human, 2026-10-16):** the 10-seat automatic match measured only 4 windows, with 4 skipped at step transitions. Follow-up when the heavy-run lock is free again: a run with a longer measurement budget, or a seeded run that holds each step long enough (lower time scale or `VOICE_E2E_AUTO_BUDGET_MS`), to strengthen the automatic-mode audio evidence. Does not block the merge of a9b411d.

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
