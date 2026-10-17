# Visual baseline (Human decision, 2026-10-17)

The chosen visual baseline is the original camp scene and UI as served in the decision-maker's local preview of dev `44fb793` (127.0.0.1:4480/4481). This is a baseline for direction, not final acceptance of the product. The "mature/cinematic" redo (direction-2) is stopped; its work in progress stays on branch `visual-6` (e9a2ad9) and is not continued.

## What represents the baseline

| Item | Where |
|---|---|
| Scene code | `packages/scene` at dev 44fb793 (renderer identical from 04e10ed onward, apart from the changes listed below) |
| Captures | `docs/visual/preview/*.jpg` and `motion.mp4` (Playwright WebKit, browser emulation; generated from the same renderer at 04e10ed / 3225999) |
| Notes | `docs/visual/PREVIEW.md` (what is representative vs placeholder, open questions), `ASSETS.md`, `PERF.md` |
| Harness | `node scripts/env.mjs npm run dev -w @moonveil/scene` → http://127.0.0.1:4200 (`?quality=high` to force the baseline look) |

## Changes to `packages/scene` in dev since 44fb793

Only `visual-7` (1a4952b, cost modes; merged at 24f4ae8). Diff reviewed line by line against the baseline:

- **Per-frame rendering at `high` is unchanged**: same resolution cap, lightmap every frame, sway, ripples, fireflies, glints, fog, sparks and smoke all run as before.
- **Two behavioural differences at `high`**, not look changes per frame:
  1. The ticker is now capped at 60 fps (`maxFPS = 60`; before: uncapped, so 120 Hz displays ran at 120 fps). Animation timing uses real elapsed time, so motion speed is identical; only smoothness on high-refresh displays is reduced. Cheap to restore (`high` → uncapped) if wanted.
  2. The shell mounts with `quality: 'auto'`. `auto` resolves to `low` under automation (`navigator.webdriver`) and on devices with ≤ 4 cores or ≤ 4 GB reported memory. On such devices the look is `low` (below), not the baseline. The decision-maker's desktop preview resolves to `high`.
- Frames stop while the document is hidden; `prefers-reduced-motion` caps at 4 fps and stops sway/ripple motion in any mode.

Earlier scene changes already contained in 44fb793 and part of the baseline: `visual-3` (adapters, tap-to-walk, ResizeObserver, portrait camera decided from the slot size) and `visual-5` (keyboard fix P14).

## `low` mode vs the baseline look

`low` is what automated tests and low-end devices see. Differences from `high`:

- Canvas at device pixel ratio 1 (softer on retina and phone screens).
- 30 fps cap; lightmap updated every other frame (fire flicker steps at 15 Hz).
- No tree sway, no water ripple scrolling, no fireflies, no moon glints on the water, no night fog.
- Fire flames still animate; no sparks and no smoke.
- Everything else identical: map, palette, lighting colours, avatars and labels, speaking indicator, walk/seat/tent choreography, night and dawn transitions, ghost treatment.

`off` renders nothing (no canvas, no loop) and is for suites that do not measure visuals. Harness override: `globalThis.__MOONVEIL_SCENE = 'off' | 'low' | 'high'` (env mirror `MOONVEIL_SCENE`).

## Status

Further art polish within this direction waits for Human scope confirmation. No captures or production work are planned until then.
