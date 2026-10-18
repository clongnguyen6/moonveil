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

### LiveKit Cloud check, run 2 (2026-10-18 12:08–12:10, lock held; live deploy f12761a at https://www.moonveil.id.vn, new defense rule; test files 5e4f0ca)

Scene off, `join()` per page, no traces. Conditions: load 3.0–5.6, CPU idle 58–67 %. **Participant-minutes: 6.3 (cloud-check, cap 6) + 2.8 (rotation gaps, cap 4) = 9.1; aggregate about 24.8 of 100.**

- **Defense (new rule):** 6 living seats held public speak; **public room generation unchanged** through the defense step (no rotation); the defense hear-matrix window had **0 failures** (every living player heard by the others, moderator and ghost).
- **Leakage:** 0 "must not hear" failures in every window (lobby, night 1, day, defense, night 2). Night: 2 wolves on the wolves channel, 5 others none; rosters clean.
- **Revocation:** executed seat's old public token `/rtc/validate` 401, fresh token 200.
- **Join time ("Connecting voice…")**: lobby join median 10.1 s, p95 10.9 s (Cloud; local 3.6 s). Rotations: start→night 2.6 s, night→day 1.5 s, execution 1.5 s medians; night 2→day 2 median 8.9 s (p95 9.7 s) this time versus 1.4 s in the previous Cloud run: the second-day reopen varies between runs; nobody unheard.
- **8 "should hear" failures are a measurement artifact of my cap:** the budget guard hit 6.3 minutes while the night-2 window was being measured and called `leave()` on every page mid-window; all 8 are in that window (wolves and ghosts speakers who had just been disconnected). The windows before the abort are the evidence; the cap should be set above the planned path next time (≈ 7 for this path).

### Rotation gaps, Cloud vs local (2026-10-18 01:02–01:07, lock held; test files 1b4a836 + measurement fix)

Gap = time from the first new-generation `voice` frame of a transition until each listener's received energy from each expected speaker starts to grow (polled every 250 ms, no settle wait first). 7 players + moderator, moderator mode, scene off, `join()` per page, no traces. Conditions: load 3.2–6.1, CPU idle 69–77 %, browser GPU process 0 %. Logs: `.cache/voice-gap2-cloud.log`, `.cache/voice-gap2-local.log` (a first attempt, `.cache/voice-gap-*.log`, measured after the settle wait and is superseded; its Cloud invocation also re-ran the cloud-check by title match, 5.0 participant-minutes, defense window failed identically on the deployed old rule).

| Transition | pairs | Cloud median / p95 / max (ms) | Local median / p95 / max (ms) | Cloud ÷ local (median) |
|---|---|---|---|---|
| lobby join (join → first audio, incl. mic + publish + subscriptions) | 56 | 9,692 / 10,485 / 10,490 | 3,573 / 4,124 / 4,131 | 2.7 |
| start → night.main (wolves room opens) | 4 | 2,405 / 2,405 / 2,405 | 509 / 509 / 509 | 4.7 |
| night → day.discussion (public reopens, rotation) | 43 | 1,421 / 1,690 / 2,202 | 685 / 961 / 961 | 2.1 |
| execution → next step (public rotates, ghost joins ghosts) | 8 | 1,558 / 2,333 / 2,333 | 538 / 797 / 797 | 2.9 |
| night 2 → day 2 (public reopens, rotation) | 56 | 1,389 / 1,656 / 1,656 | 886 / 902 / 902 | 1.6 |

No pair was ever unheard within the 25 s limit on either target. Defense caused no rotation on either (new rule). Cloud rotations are 1.6–4.7× local in median, but at most 2.4 s at p95 and 2.3 s max: audio is back within about two seconds of a room rotation through Cloud (Hyderabad region from this client). The lobby join is the long one (about 10 s on Cloud, 3.6 s local): mic acquisition, connect, publish and 7 subscriptions per page, serialized `join()` calls in the test; the UI should show a "connecting voice" state (the snapshot exposes it) rather than treat it as silence.

Budget: this slot used 5.0 (unplanned second cloud-check) + 2.3 + 2.8 = 10.1 participant-minutes; **aggregate about 15.7 of 100** (5.6 before the slot).

Open: the deployed app still runs the accused-only defense rule, and in both cloud-check runs the listeners measured no energy from the accused for the 2 s window taken after their tracks were subscribed (≥ 3 s after the defense rotation). The gap data above shows rotations recover in ≤ 2.4 s, so that window is specific to the old defense path (a single publisher republishing after a rotation that hides everyone else), which no longer exists under the approved rule; it will not be seen once the new rule is deployed. Recorded, not resolved.

### LiveKit Cloud runtime check, run 1 (2026-10-18 00:17:34–00:18:22, lock held; deployed app https://moonveil-production-b733.up.railway.app, test files 3d18e7f)

8 headless pages (7 players + moderator), scene off, `join()` per page, traces off, cap 60 participant-minutes. Conditions: load 4.3–4.5, CPU mostly idle, browser GPU process 0–15 %. **Participant-minutes used: ~5.1** (connected channels × time, sampled every 5 s; foundation's smoke ≤ 0.5 before this). Artifacts: `.cache/voice-cloud-run1.log`, `.cache/voice-cloud/results-cloud1/` (error context only; no traces), `.cache/voice-cloud-conditions.log`. No token appears anywhere.

Findings via Cloud:
- Signaling host `personal-c15mov1e.livekit.cloud`; `/settings/regions` (200) lists, by distance from this client: ohyderabad1a 3,122 km, oosaka1a 3,952 km, otokyo1a 4,341 km, odubai1a, osydney1a, ojeddah1a. No Singapore region is offered; the client's nearest is Hyderabad.
- Night: 2 wolves held the wolves channel, 5 others held none; moderator held public, wolves, ghosts; the executed seat became a ghost with public + ghosts.
- **Revocation:** the executed seat's old public token → `/rtc/validate` **401**; a fresh token → **200**. Cloud rejects the old token after the rotation with `RemoveParticipant`+`revokeTokenTs`.
- Rosters in every window: no ungranted seat, no listen-only seat visible (moderator and ghosts hidden). `voice` frames: no channel beyond grants, no `speak` beyond the state grant. Channels matched grants on every page after each step (no settle failure, no unresponsive page).

**Measured hear-matrix (separate):** 308 pair-channel checks over 5 windows: lobby 56 checks 0 failures; night.main 0 failures; day.discussion 0 failures; **day.defense 7 failures**: every listener (6 living + moderator) measured 0 energy from the accused, the only permitted speaker, in the 2 s window taken right after the defense rotation; night 2 0 failures. No "must not hear" failure anywhere. The defense window was measured within seconds of a rotation (everyone reconnects through Cloud and the accused republishes); the later window shows audio flowing again. Reading: a post-rotation timing gap on Cloud longer than the local 2–5 s assumption, not a routing error; not confirmed by a rerun. **Not confirmed**: a rotation-gap measurement across deaths and night transitions (Cloud vs local, ≤ 15 participant-minutes) is planned under the probe budget. The defense rotation itself is gone under the rule of 2026-10-18 (every living player speaks; gateway unit test), which does not settle the gap question for the remaining rotations. The spike's defense checks were updated to the new rule and not rerun (heavy); the release acceptance covers the defense path locally.

### Slot 19 (2026-10-17 18:06–18:44, lock held; candidate 705faad = e432694 (D2 explicit join, D5) + dev 758c44a + a type-only fix): ALL GREEN

Scene loop stopped in test pages (`MOONVEIL_SCENE=off`), `join()` called on every page (D2). Conditions sampled every 30 s (`.cache/voice-e2e/conditions-slot19.log`): load 1-min 3.9 at start, peak 8.2, 6.5 at end; CPU idle 54–73 %; browser GPU process 0–29 % during matches (peak 100 % at page load; 620–730 % with the scene running in runs 15–17); 10–12 renderers summing ~70 %; memory 35 GB used, 7 GB in the compressor.

Root check on 705faad: typecheck ok; rules 206, scene 26, voice 53, server 96, harness 2, e2e 13/13 (1.8 min). An earlier root check on 6afa3a3 (same product behaviour) failed only because `apps/web` builds an empty `VoiceSnapshot` literal and D2 had added two required fields; they are optional in the type since 705faad.

**Measured hear-matrix on 705faad** (received audio energy per channel and remote seat, 2 s window after every step, versus the matrix derived from each seat's own `state.voice`):

| Run | Match | Steps | Pair-channel checks | should-hear failures | must-not-hear failures | Skipped |
|---|---|---|---|---|---|---|
| 21 | moderator, 7 + mod, complete match, scale 2 (44.5 s) | 11 | 658 | 0 | 0 | 0 |
| 21 | automatic, 10 seats, scale 2, 5-min budget (5.2 min) | 14 | 1,278 | 0 | 0 | 0 |
| 22 | automatic, 10 seats, real time, 10-min budget (10.2 min) | 12 | 981 | 0 | 0 | 0 |

Per step, run 21 moderator: lobby 56, night.main 35/63, night.witch 35/63, day.discussion 70, day.vote 70, day.defense 70, day.confirm 70, hunter 70, ended 56. Run 21 automatic: lobby 90, night.main 18/63, night.witch 18/63, hunter 90, day.discussion 108/126, day.vote 108/126, day.defense 108/126, day.confirm 108/126. Run 22 (real time): lobby 90, night.main 18/54, night.witch 18/54, day.discussion 99/117, day.vote 99/117, day.defense 99/117, day.confirm 99. The run-13 question (one should-hear failure after a rotation, real time) is settled: 0 failures over 981 real-time checks with the settle fix, and 0 over 1,278 at scale 2.

**Token / channel checks (separate), all pass:** channels equal grants and connected on every page; rosters only granted seats, never a listen-only one; `voice` frames never carry an ungranted channel or `speak` beyond the state grant; moderator hidden while listen-only and visible at `ended`; in-person room (5.7 s): no sessions, no LiveKit room, no voice channel, public text delivered. Nothing connects before `join()` (D2, unit-tested; the suite joins explicitly).

The same three suites also passed on 6afa3a3 (runs 19/20: 1,183 + 828 + 981 checks, 0 failures, 0 skipped) before the type-only fix.

Scope statements for this record: run 22's real-time automatic match ran to its 10-minute budget (12 steps, into the second day's defense), not to a match end; the complete-match evidence in automatic mode is run 21 at scale 2 (14 steps, likewise budget-bound) and the moderator matches, which end. Both suites ran with the scene loop stopped (`MOONVEIL_SCENE=off`); the scene's own CPU cost is the visual owner's item. LiveKit Cloud is still untested: every measurement here is against the pinned local OSS server (`CLOUD.md` §5).

Merged: `dev` fast-forwarded to ce2dadc on 2026-10-17 after a root check on that exact SHA (rules 206, scene 26, voice 53, server 96, harness 2, e2e 13/13).

### Slot 17 (2026-10-17 14:35–, lock held; candidate 1d12fc6 = d85b133 + dev 36bdafd): A/B and run 17, FAILED; cause found by measurement

Kept: `.cache/voice-e2e-ab17-off.log`, `.cache/voice-e2e-ab17-on.log`, `.cache/voice-e2e-run17.log`, per-run artifacts `.cache/voice-e2e/results-ab17-off/`, `results-ab17-on/`, `results-run17/` (error contexts + traces), `.cache/voice-e2e/conditions-slot17.log`, `conditions-ab17-off.log`, `conditions-ab17-on.log`, LiveKit server log `.cache/voice-e2e/livekit.log`.

Root check on 1d12fc6 (load 2.7): rules 206, scene 20, voice 50, server 91, e2e 13/13.

**A/B, same test files, `MOONVEIL_TEST_SEED=voice-ab!`, scale 2, back-to-back:**
- revoke **off**: moderator and automatic both failed: "Ann: page unresponsive, voiceSnapshot did not return within 15000 ms", "Chi: … voiceStats …".
- revoke **on**: moderator measured 1 window (night.main#0, 35 checks, 0 failures; settle evidence: Ann's wolves room `connecting` → `connect timed out after 20000 ms` → `connecting` again), then the browser was closed at the test timeout; automatic: "Bao: page unresponsive".
- Conclusion: **revoke-before-delete is not the distinguishing factor**; both variants fail the same way. The `VoiceClient` publish-hang fix (d85b133) did not make the full matches pass either; it holds only what its unit test shows (a stuck publish no longer blocks applying sessions). Conditions during the A/B: load 1-min peak 78 (0.5–0.8 % idle), 35 GB used, 15 GB in the compressor, <130 MB free, swap-ins/outs in the millions.

**Cause, measured live during run 17 (three samples 5 s apart):** the headless browser's **GPU process at 624–728 % CPU** (`--use-angle=swiftshader-webgl`: software WebGL), each of the 11 page renderers at 5–14 %. Every page mounts the camp scene (`apps/web/src/ui/SceneMount.tsx` → `@moonveil/scene`, pixi.js 8, WebGL); 11 software-rendered scenes take 6–7 of the machine's 11 cores, on top of other projects' load and heavy memory pressure. That starves everything in the browser at once: `page.evaluate` (the new 15 s bound turns the starvation into a named failure where the old unbounded harness simply waited), ICE (`could not establish pc connection`, `short ice connection`), mic publishes (run 16's one seat with a single publish event). It also explains the history: the scene entered the web shell on 2026-10-16 ~18:15–21:00 and grew (textures, visual-5); runs 8–10 predate it, run 11 and 13 passed partially on an earlier scene, runs 15–17 fail. No renderer spins, so a client-side busy loop (hypothesis 1) is ruled out by the per-process numbers; what the renderers do during the 15 s is wait for CPU.

**Run 17 (full suite, scale 2, same slot, 15:05–15:16, load 1-min 20–34, 0.5–2 % idle):** all three tests failed with "page unresponsive" (`Mod`, `Bao`, and `Host` in the in-person test, which uses no voice at all). A page that cannot answer `evaluate` within 15 s while holding no LiveKit connection is starvation, not voice.

**Mitigation for this suite (test-only, `packages/voice/e2e`, 4b0a299):** pages get an init script that sets the agreed switch `globalThis.__MOONVEIL_SCENE` from `MOONVEIL_SCENE` (default `off` in this suite) and, until the product honours it (visual-7), stops the frame loop by never firing `requestAnimationFrame` when `off`. The suite measures audio, not visuals.

**Run 18 (verification, 15:16–15:18, moderator match only, scene loop stopped, same machine, load 1-min 14.6 at start / 8.7 at end):** complete match in **1.9 min** (runs 11/15/17 on the same match: 9–12 min or timeout), **1,554 pair-channel checks over 21 steps, 0 should-hear and 0 must-not-hear failures, 0 skipped windows**; per step: lobby 56, night.main 35/49/84/84, night.witch 35/49/84/84, day.discussion 70/91/98, day.vote 70/91/98, day.defense 70/91, day.confirm 70/91, hunter 98, ended 56. Browser CPU sampled every 10 s (`.cache/voice-e2e/browser-cpu-run18.log`): GPU process median 18 %, peak 174 % during the initial page loads, 0 % for most of the match; 10 renderers summing 22–39 %. Before (runs 15–17): GPU process 620–730 % sustained. Token/channel checks all pass. Still to run under the mitigation: the automatic match, the in-person test, and the real-time automatic rerun.

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
