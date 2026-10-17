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
- **Time** (TEST ONLY): `MOONVEIL_TEST_TIME_SCALE` on the real-engine server (playwright default 20; the match scripts set ×10, see Strict pacing). Server clock and timers run 20× faster; the engine still sees 60 s nights and all approved timings. Server tests verify real durations.
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

## Deterministic end paths (foundation-8)
- **One bot policy for every driver** (`apps/server/test/bot-policy.ts`): server-level scripted clients, the browser protocol actor and the UI actor make identical choices. A strict browser match (every intended action lands) therefore plays out exactly like its in-process simulation.
- **Seeds (test-only):** `MOONVEIL_TEST_SEED=<base>` → match seed `<base>:<host name>`. Each acceptance match names its host after its seed `S` and uses `S` for the bots. Order and filters don't matter.
- **Fixed table** (`apps/server/test/acceptance-seeds.ts`), chosen with `seed-search.ts`. Per mode across 7–10 seats it covers wolves/parity, village/noWolves and draw/stalemate (rules-12):

  | Mode | 7 | 8 | 9 | 10 |
  |---|---|---|---|---|
  | automatic | a7-0 wolves | a8-6 village | a9-3 wolves | a10-16 stalemate |
  | moderator | m7-2 village | m8-3 wolves | m9-54 stalemate | m10-39 village |

  Phones reuse the 7-seat seeds. Every browser suite asserts each match's expected outcome. `acceptance-seeds.test.ts` re-simulates the table in-process, so a rules change that shifts an outcome fails a light test, not only the heavy suites.
- **Q14 zero survivors:** reachable. Found within seats + 3 days for automatic 9 and 10, and moderator 7, 8 and 9; none in 2,000 seeds for automatic 7/8 or moderator 10. Added as extra matches: `a9-1025` (automatic, 9, day 5) and `m7-1124` (moderator, 7, day 3), so each mode covers all four end paths (`EXTRA_SEEDS`, required by `acceptance-seeds.test.ts`). Phones run the 7-seat cases (`a7-0`, `m7-2`, `m7-1124`).
- **Search scripts must yield to the event loop between simulated matches.** Otherwise pending voice-sync callbacks hold every room and memory grows about 0.5 MB per match. Measured: flat at 10–14 MB over 400 matches with yields. Not a server leak.

## Strict pacing: no skipped steps (foundation-9)
- **Why:** on foundation-8 (`5b081c4`) the protocol suite at ×20 acted in fewer steps under load. `a7-0`: 14 loop iterations without voice, 13 with. `a9-3`: 34 vs 25. A step that passes between two loop iterations gets no bot action, so later bot choices diverge from the in-process simulation. The outcomes still matched, by luck of the path.
- **Check:** `skippedSteps(m)` (`e2e/harness/match.ts`) = step keys (`night/day/kind`) that the driver's socket saw while playing but the loop never acted in. `withActions` marks steps where some seat's own view offered actions. Same-key collisions merge, so it can only under-count. Unit test: `e2e/harness/match.test.ts`.
  - `real-match.spec.ts` (protocol, with and without voice) **fails** on any skipped step and logs `STEPS {seed, acted, skipped}` first.
  - `real-match-ui.spec.ts` logs `skipped` in `UIMATCH` and, in strict runs (`E2E_UI_STRICT=1`, i.e. `e2e:ui:accept`), **fails** on any (foundation-10). Basis: 0 skipped steps in all 16 strict matches at ×5/×2 on `36bdafd` (`.cache/runs/full-36bdafd/`). Quick runs (`e2e:ui`, ×10) only log them. Not yet run in a locked acceptance run.
  - Step-change polls run every 20 ms (views are local frames, so polling is cheap).
- **Protocol suite time scale: ×10** (default of `e2e:matches` and `e2e:matches:voice`; `E2E_TIME_SCALE` overrides). Locked run on `9a806be`, 2026-10-17 (`.cache/runs/pacing-x10-9a806be/`):
  - 0 skipped steps in all 10 matches, with and without voice;
  - identical acted-step counts in both runs (a7-0 14, a8-6 10, a9-3 25, a10-16 12, m7-2 7, m8-3 14, m9-54 14, m10-39 21, a9-1025 27, m7-1124 19);
  - every expected end path reached;
  - 8.1 min without voice, 8.5 min with (×20 took 4.7 min);
  - load 3.3 → 4.3, 1.8–3.0 GB free; peaks: browsers 3.4 GB RSS and 484 % CPU, server 336 MB.
  ×5 was not needed.

## Scene cost per suite (foundation-10, needs visual-7 in `dev`)
- Knob (visual-7, `docs/visual/MOUNT.md`): `quietUi(p, scene)` in `e2e/harness/ui.ts`.
  - `off`: the Settings scene switch is off and the page override `globalThis.__MOONVEIL_SCENE = 'off'` is set, so there's no canvas and no loop.
  - `low` / `high`: scene on, with that override.
  - `auto`: scene on, no override; the scene picks `low` under `navigator.webdriver`.
  - Env `MOONVEIL_SCENE=off|low|high|auto` overrides a suite's default; any other value is an error.
- **Protocol and voice suites** (`real-match.spec.ts`): `off`. They assert the wire. Voice measured 11 software-rendered scenes at 600–700 % CPU in the GPU process.
- **Strict UI suite** (`real-match-ui.spec.ts`): `auto` (resolves to `low`), on every context in all three projects, so the UI is exercised with the scene mounted.
- Each match logs its mode (`scene` in `MATCH`, `STEPS`, `UIMATCH`).
- Before foundation-10, every real-match suite ran with the scene switched off (quiet settings).
- Not yet run in a locked run. If scene cost breaks pacing (misses or skipped steps), that's a finding to report, not a reason to switch the suite to `off` silently.

