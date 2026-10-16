# 0006: Acceptance harness for full browser matches

Status: foundation, 2026-10-16. The harness is ready now; the UI-driven layer waits for the game UI's real-client wiring.

## What runs today (`npm run e2e:matches`, opt-in)
- `e2e/tests/real-match.spec.ts` runs 8 matches with the REAL rules engine: 7, 8, 9 and 10 browsers each, in both modes. One BrowserContext per seat.
- **Driver** (`e2e/harness/match.ts`): create, join, ready, start and every game action go through the page's real client (`window.__moonveil`, owned by `apps/web/src/client.ts`), over the page's own socket. Bots read only their own wire view (`me.actions`). No UI selectors, so it survives UI changes.
- **Assertions** on every browser's wire: `apps/server/test/assertions.ts`, shared with the server tests.
  - isolation on every snapshot;
  - open day ballots at every vote step (same voter→choice map everywhere; own slot = own ballot);
  - wolf chat reaches wolves only;
  - outcome matches the approved win conditions;
  - the moderator gets moderator data.
- **Time** (TEST ONLY): `MOONVEIL_TEST_TIME_SCALE=20` on the real-engine server. Server clock and timers run 20× faster; the engine still sees 60 s nights and all approved timings. Server tests verify real durations.
- **Ports:** `scripts/e2e-run.mjs` gives OS-assigned free ports (`E2E_PORT` fixture server, `E2E_REAL_PORT` real server, `E2E_RESTART_PORT`).
- **Not in `npm run check`:** about 4 min and up to 10 browser contexts at once on a shared machine. Becomes part of acceptance runs.

## UI-driven layer: adopts docs/ui/SELECTORS.md (game-ui 1bff25f)
- **Owner:** the UI owns the DOM, and its `SELECTORS.md` is the contract. Foundation's earlier name proposals are withdrawn.
- **`e2e/harness/ui.ts`** performs each bot choice through the documented hooks:
  - targets: `seat-<index>` + `confirm`;
  - nomination and verdict: `vote-skip`, `vote-yes` / `vote-no`;
  - Witch: `heal-yes` / `heal-no`;
  - moderator: `close-step` + the dialog confirm;
  - entry and lobby: `name`, `create-<mode>`, `code`, `join`, `ready`, `start`;
  - state: `room[data-status]`.
  - Runs use the documented quiet settings (`scene:false, sound:false, reducedMotion:'on'`).
- **Choices come from the seat's own wire view;** assertions stay on the wire. So the harness doesn't need `step-seq` or any extra DOM state.
- **`e2e/tests/real-match-ui.spec.ts`:** 7–10 browsers in both modes. It skips itself until `[data-testid=entry]` exists in the served build, so it can't pass vacuously. Run with `npm run e2e:matches`.
- **Counter-proposal (one gap):** chat tabs are only `.tabs .tab` by order. Selecting a channel reliably (e.g. wolves at night) needs `[data-testid=chat-tab][data-channel=<id>]`. Until then, chat isolation stays asserted at protocol level (`real-match.spec.ts`).
- **Kept by foundation:** `window.__moonveil` (own seat data only) for reading the view and as the protocol fallback.
