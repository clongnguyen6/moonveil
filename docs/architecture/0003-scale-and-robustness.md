# 0003: Scale and robustness evidence (2026-10-16)

FIXTURE engine (not real rules). Shared machine: 11 cores, 36 GB, busy with other rooms' work. Chromium headless, one browser, one context per player. Code revision 16dc540 (load avg 6.5–10.4 during runs).

## Scale (`E2E_SCALE=10,12,16,20 npm run e2e:scale`, `scripts/sample-resources.mjs`)
| N | seat all (UI joins) | start fan-out | timer phase spread | max state frame | bytes/player/game | browser peak RSS | server peak RSS | result |
|---|---|---|---|---|---|---|---|---|
| 10 | 3.3 s | 57 ms | 0 ms | 2.3 KB | 34 KB | 1.7 GB | 108 MB | pass, no leaks |
| 12 | 3.5 s | 48 ms | 0 ms | 2.7 KB | 44 KB | 2.1 GB | 112 MB | pass |
| 16 | 4.8 s | 39 ms | 2 ms | 3.5 KB | 67 KB | 2.7 GB | 111 MB | pass |
| 20 | 6.2 s | 48 ms | 2 ms | 4.2 KB | 99 KB | 3.3 GB | 112 MB | pass; 21st join → "room is full" |

- Peak RSS is the process-group sum. Server avg CPU ≈ 1%.
- The last player in each run used Pixel 7 emulation: no horizontal overflow at any N.
- Limits:
  - Rules engine v0.1 allows 6–16 players (provisional Q18); the fixture allows 3–20.
  - Browser memory (~100–170 MB/session) limits how many sessions one test machine can run, not the product.

Server fan-out (`npm run bench`, in-process, one public change re-sent to every seat):

| N | 10 | 16 | 32 | 64 | 128 | 256 | 512 |
|---|---|---|---|---|---|---|---|
| ms/change | 0.05 | 0.12 | 0.4 | 1.5 | 5.7 | 23 | 91 |
| bytes/change (all seats) | 14 KB | 33 KB | 124 KB | 474 KB | 1.9 MB | 7.4 MB | 29 MB |

Full per-seat snapshots cost O(N²) bytes per change. Irrelevant at ≤ 20 players.
**Breaks for movement:** lobby/ghost free movement at 10 Hz via snapshots would be 16 seats × 10 Hz × 16 × ~2 KB ≈ 5 MB/s.
Movement must be a separate per-viewer-filtered position channel: ghost positions only to ghosts, nothing during secret phases unless entitled. Design with the visual owner before movement is wired.

## Robustness (`e2e/tests/network.spec.ts`, `robustness.spec.ts`, `apps/server/test/idle.test.ts`)
- **Silent network (no close):**
  - Before `33e2b6c`, the client stayed "open" indefinitely: `ws.close()` waits for an `onclose` a dead link doesn't deliver. Bug fixed.
  - Now: client notices in 25.4 s (watchdog), server in ~27 s (ping), resume 40 ms after the link returns.
  - Short blip: the `online` event forces a fresh connection; caught up in 0.8 s.
  - Players learn nothing of a drop during a secret phase.
- **Frozen tab:**
  - Headless Chromium ignores `Page.setWebLifecycleState` (page stays visible, timers run). The test uses `Debugger.pause` instead (2 timer ticks in 30 s = really frozen).
  - Server keeps the socket (the network stack answers pings), so the moderator sees the frozen player as online.
  - On resume the page applies queued frames in 11 ms, without reconnecting.
  - Not modelled: iOS suspending the whole app (socket dies). The `visibilitychange` staleness check covers that; untestable headless.
- **Idle rooms:**
  - Closed when no connection for `MOONVEIL_ROOM_IDLE_MS` (default 30 min), checked each heartbeat (10 s). A reconnect resets the clock.
  - After the sweep, resume → "no such room"; the client clears the token and shows the join form.
  - Automatic matches used to keep advancing with nobody connected. Superseded by the approved pause rule (foundation-3): timers pause while all player seats are disconnected.
- **Server restart (SIGTERM and SIGKILL):**
  - Players see "Reconnecting…" over the stale game view (own secret still on screen, nothing new).
  - About 0.3–0.4 s after the server is back: "no such room", token cleared, join form. The match is lost.

## Restart recovery (built, foundation-4)
- Each room is saved as JSON after every persistent change (`apps/server/src/store.ts`): seats and tokens, mode, voiceMode, engine state incl. its clock, chat, frozen presence.
  - Location: `MOONVEIL_DATA_DIR` (default `<repo>/.data/rooms`, gitignored); write `.tmp` then rename; files 0600; deleted on room close. `MOONVEIL_PERSIST=0` disables.
  - Not saved: sockets, poses, speaking, timers.
- Boot restores all rooms (`Registry.restoreAll`). A room saved by a different engine id is skipped and its file kept.
- An automatic clock is paused at the last save time, so downtime counts as paused wall time (approved pause rule). The first player back resumes with the exact remaining time.
- Evidence:
  - `apps/server/test/restart.test.ts`: 10 min downtime gives identical views and exact remaining time; chat history and isolation hold; moderator mode; engine mismatch skipped; file store atomic/0600/corrupt-skip/remove.
  - `e2e/tests/robustness.spec.ts`: SIGTERM and SIGKILL mid-match in browsers, everyone back in about 0.3 s with identical game views, and the match continues.
- **Trust note:** in automatic mode, if the participating creator runs the server on their own laptop, the "creator gets no secrets" guarantee is app-level only. The server operator, who can read memory and `.data/`, is the trust root. Raised for a product decision.
