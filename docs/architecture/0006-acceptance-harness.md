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
- **Voice:** `npm run e2e:matches:voice` (`E2E_VOICE=1`) also starts the pinned LiveKit (voice tooling; writes only under `.cache/livekit`; UDP 4160–4199) and asserts the `voice` frames on every browser. The harness captures only the game socket (`/ws`), never LiveKit's.
- **Filters:** `E2E_GREP="…"` selects tests; `E2E_TIME_SCALE` sets the real server's time scale (default 20).
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

## Acceptance runs (strict), foundation-7
- `npm run e2e:ui:accept` = `E2E_UI_STRICT=1`. Every intended UI action must land; any miss fails the match with seat, action, step and reason.
  - A miss whose step changed between decision and click is labelled "step closed before the action (pacing)". It still fails.
  - Each match logs landed/intended (and per action type), reload-to-resume time, ghost checks and ballot steps.
  - Quick runs (`e2e:ui`, ×10) keep an 80% threshold; never use them as acceptance evidence.
- **Pacing:** laptop and Pixel 7 at ×5; iPhone 15 WebKit at ×2. WebKit emulation clicks more slowly; at ×5 a 6 s vote could close while 7 bots were still clicking.
- **Every match must reach a win condition within `seats + 3` days.** On failure it reports the room code and a public-log summary (dawn deaths, nominations, executions). Seeds are deterministic in tests (`MOONVEIL_TEST_SEED`, server log only; `<seed>!` reproduces one match).
- **Paths inside each UI match:** a page reload during the first vote (open ballots re-checked including the reloaded seat), a 3 s network drop at the first night, and ghost UI for dead seats. Ghost check: `ghost-bar` visible and no ENABLED `confirm`, `vote-skip`, `vote-yes`, `vote-no`, `heal-yes` or `heal-no`; a pending Hunter is exempt.
- Phones: no horizontal overflow on the match screen. All viewport results are browser EMULATION, not real devices.

## Findings for the UI owner
- **Dead-seat vote panel:** in moderator mode a dead seat shows the vote panel with `confirm` and `vote-skip` disabled; in automatic mode it shows none. Harmless (ghosts can't act), but inconsistent.
- **WebKit "miss" at ×5 is pacing, not a UI fault.** Repro: `E2E_UI_STRICT=1 E2E_TIME_SCALE=5 E2E_GREP="UI match, automatic, 7 " npm run e2e -w @moonveil/e2e -- --project ui-phone-webkit`, seed `e2e:1`. P4's `vote.nominate` lands after the 6 s vote closed (`confirm disabled after selecting the seat`, step already `night.main`). At ×2: 3/3 runs, 30/30 landed.
