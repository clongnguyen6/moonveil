# Small-phone campfire framing (visual-framing)

Real UI (game UI stub scenarios, chat row present), `packages/scene/scripts/framing-check.mjs`. Browser EMULATION
(Playwright Chromium headless shell; `after-webkit` = WebKit, grant b), scene `high`, not real devices.
`framing.json` per run: camera scale, smallest camper name label (CSS px), camper box vs chat row / top bar.
"before" captured on dev ce58e3b (+ debug read only); "after" on this commit's code rebased onto dev 4a27f75 (costumes and landscape top bar landed). JPEG subset here; full PNG sets (all views x day, vote, night-villager, night-wolf, ghost, ended) were generated locally, not committed.

| view | before: scale / label | after: scale / label |
|---|---|---|
| 375x667 day (chat row = 64 px safe area) | 0.156 / 4.8 px | 0.364 / 12 px |
| 375x667 night (in tents, no labels) | 0.156 | 0.216 (tents + fire) |
| 390x844 day / vote | 0.342 / 0.317, 9.6 px | 0.650 / 0.548, 12 px |
| 390x844 night | 0.317 | 0.317 (camp kept: < 10 % gain) |
| 844x390 landscape day | 0.355 / 9.6 px | 0.650 / 12 px |
| 1440x900, 1280x720 laptop | 0.877 / 0.487 | identical (all scenarios) |

Campers never overlap the chat row or the top bar, before or after, in any captured case.
