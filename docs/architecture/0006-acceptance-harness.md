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

## When the UI's real-client wiring lands: UI-driven layer (proposal for the UI owner, via Lead)
The same matches, played through the UI, with the same wire assertions.
- **Hook kept by foundation:** `window.__moonveil` (the Client; own seat data only) stays as the protocol-level fallback and for reading `view`.
- **Stable `data-testid`s requested** (names negotiable):
  - entry: `name`, `create-automatic`, `create-moderator`, `code`, `join`, `error`, `conn` (`data-status=open|reconnecting|replaced`);
  - lobby: `seat` (`data-seat`, `data-ready`, `data-connected`), `ready`, `start`, `leave`;
  - game: `phase` (text = `step.kind`), `action-<type>` (one per `me.actions` entry) with targets `target-<seatIndex>` or choices `choice-<value>`, `ballot` (own choice), `ballots` (open tally, `data-seat`/`data-choice` rows);
  - chat: `chat-tab-<channel>`, `chat-input`, `chat-send`, `chat-msg` (`data-channel`);
  - moderator: `mod-close`, `mod-confirm-count` + `mod-confirm-submit`;
  - end: `reveal`, `outcome`.
- **No test-only behaviour in the UI**: the hooks are attributes only.
