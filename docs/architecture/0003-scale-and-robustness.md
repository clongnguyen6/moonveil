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
  - **Automatic matches keep advancing with nobody connected** and can end unattended. Needs a policy, e.g. pause timers when all players are offline, or `player.remove` for long absence. That's gameplay/rules (rules API: disconnects are server policy).
- **Server restart (SIGTERM and SIGKILL):**
  - Players see "Reconnecting…" over the stale game view (own secret still on screen, nothing new).
  - About 0.3–0.4 s after the server is back: "no such room", token cleared, join form. The match is lost.

## Restart recovery: proposal (not built)
- **Worth doing, after real rules are wired.** A host laptop crash or an accidental Ctrl-C would otherwise end a 30-minute match for 10 people.
- **Cheap because:**
  - Rules state is plain JSON (rules API.md: "Persist it as is").
  - The client already resumes by token.
- **Shape:**
  - Write-behind snapshot of each room (seats, tokens, mode, engine state, phase deadline) to a gitignored data dir via atomic rename after each mutation.
  - Load on boot and re-arm timers from the saved deadline.
  - Flip the restart spec to "match continues".
- **Effort:** small (one module + tests).
- **Risk:** secrets and bearer tokens on the host's disk. The host operator can already read all secrets from memory, so persistence adds little exposure. Delete on room close.
- **Trust note:** in automatic mode, if the participating creator runs the server on their own laptop, the "creator gets no secrets" guarantee is app-level only. The server operator is the trust root. Needs a product call (separate host, or accept).
