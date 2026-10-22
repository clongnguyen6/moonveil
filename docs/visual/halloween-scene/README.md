# "Cute Halloween" scene preview (dev-only, for direction review)

Code: `packages/scene/src/themes/` (branch `visual-halloween`). Switch: scene dev page `?theme=halloween`
(SceneOptions.theme). Honoured only in a Vite dev build; every theme reference sits behind `import.meta.env.DEV`, so a
production build contains none of it (web app production build: 0 "halloween", 0 overlay colour values; controls found).
Never from the wire, never on by default, no seasonal activation.

Captures: scene dev page, 8 players, **Chromium/WebKit emulation** (Playwright, headless), not real devices; scene at
the SHA in `conditions.txt`. Palette: working palette + art-halloween 5333b83 refinements (`HALLOWEEN` /
`HALLOWEEN_NIGHT` in `themes/halloween.ts`, one place to swap).

- `after/`: phone 390x844 and laptop 1440x900 x lobby, campfire day, campfire night x `high`, `low`.
- `before/`: same views without the theme (`high`).
- `compare/real-vs-decorative-ghost-crop.jpg`: one frame, one scale: real ghost (Bảo: pale-blue camper, head, arms,
  tail, aura, name) vs decoration (small warm-ivory sheet ghost on a thread with an orange bow; no aura, wisps or tail;
  never free-moving). Full frames day/night beside it; reduced-motion night capture.
- `webkit/`: phone night high/low, lobby high.
- `halloween-check.json`: per capture, theme active, animating or not, decoration counts, labels above every effect layer.

## What it adds

Pumpkins around the campfire (outside the seated ring, clear of every seated camper's screen box) and beside some
tents; two sparse back-row strands of amber-majority lights (2 orange : 1 purple) with one small ghost ornament each;
30-60 dry leaves in clusters at the camp's edge; a warmer plum kept to the night shadows (stream stays blue, grass
green). Campers, costumes, labels, rings, rules: unchanged. Placement rules are unit-tested for 4-16 players.

## Performance (shared machine, load 11-18 during the run, see conditions.txt; software WebGL in headless Chromium)

- `low` and reduced motion: everything static. Per frame the overlay returns after one comparison unless the night
  level changed; the lightmap still renders only on change. Measured update JS 0.12 -> 0.12 ms (run 1, load ~12) and
  0.11 -> 0.21 ms (run 2, load ~17, 13 samples): within shared-load noise, no added per-frame work by construction.
- `high`: gentle pumpkin flicker, bulb twinkle, ornament sway: update JS about +0.1 ms avg (0.27 -> 0.36, 0.36 -> 0.46).
- Frame times are not meaningful here (automation caps `low` at 10 fps; software WebGL renders `high` at ~3-4 fps
  under this load). Measure on a GPU-backed browser before any production decision.
