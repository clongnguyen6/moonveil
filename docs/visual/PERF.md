# Scene performance under emulation

Measured on the production build (`vite build`, `vite preview` on :4201) in Playwright **WebKit, unthrottled**, GPU-backed (Apple GPU, M3 Pro dev machine). **This is browser emulation, not a device.** WebKit exposes no CPU-throttling control, so the mid-range-phone stand-in (CPU-throttled Chromium) was **not measured this round**: full Chrome for Testing writes outside the repo and is no longer used. Each row: 2.5 s warm-up, then 5 s of frames. Script: `packages/scene/scripts/perf.mjs` (`node scripts/env.mjs node packages/scene/scripts/perf.mjs`). Revision: see commit.

Columns: frame = wall time between frames (vsync-locked at 60 Hz when under budget); update = scene/choreography/particles JS; lightmap = quarter-res light pass JS; pixi render = Pixi's JS submission of the frame. GPU time is not visible from JS.

| emulation (WebKit, unthrottled) | scene | avatars | frame avg ms | frame p95 ms | update js ms | lightmap js ms | pixi render js ms |
|---|---|---|---|---|---|---|---|
| phone 390×844 @2x | lobby | 10 | 16.66 | 18 | 0.31 | 0.1 | 0.92 |
| phone 390×844 @2x | night | 10 | 16.67 | 18 | 0.23 | 0.07 | 0.41 |
| phone 390×844 @2x | lobby | 16 | 16.67 | 18 | 0.24 | 0.03 | 0.48 |
| phone 390×844 @2x | night | 16 | 16.67 | 18 | 0.2 | 0.04 | 0.34 |
| phone 390×844 @3x | lobby | 16 | 16.72 | 18 | 0.11 | 0.14 | 0.41 |
| laptop 1440×900 @1x | lobby | 16 | 16.67 | 18 | 0.22 | 0.04 | 0.34 |
| laptop 1440×900 @1x | night | 16 | 16.67 | 18 | 0.11 | 0.08 | 0.25 |

## Reading

- Every configuration is vsync-locked at 60 fps (frame avg 16.7 ms, p95 18 ms), 10 and 16 avatars, day and night, phone 2x/3x and laptop.
- Total JS per frame is about 0.5 to 1.3 ms unthrottled, so roughly 8% of the 16.7 ms budget. Pixi's render submission dominates, then the scene update, then the lightmap pass. Avatar count barely moves the numbers.
- Earlier round (Chromium, CPU throttled 6x, 16 avatars, same renderer before extraction): about 3.8 ms JS per frame, still 60 fps. That measurement is retained as history only; it was taken with full Chrome for Testing, which is not used any more.

## Not measured, risks

- Phone GPU fill-rate (lightmap, vignette, night fog and tint quads, ripple tiling). First cuts if a phone struggles: fog off, lightmap at 1/8 resolution, one ripple layer. None change the look.
- CPU-throttled frame times this round. Option if needed later: a sandboxed full-Chrome run that cannot write outside the repo (needs a `sandbox-exec` profile verified first), or a real device.
- Memory on low-end devices; iOS Safari specifics beyond WebKit emulation.

## Software-WebGL cost of `low` (2026-10-18, headless Chromium with SwiftShader, as the test harnesses see it)

Probe: `packages/scene/scripts/longtask-probe.mjs` and `longtask-contention.mjs`, 1280×720, night scene, 10 players. Emulation, not a device.

| config (single page, 20 s) | fps | p95 frame gap ms |
|---|---|---|
| `low` before this change | 7.7 | 150 |
| + antialias off | 11.2 | 117 |
| + ripples off | 8.5 | 150 |
| + lightmap on change | 7.7 | 150 |
| + fps cap 15 | 7.7 | 150 |
| all four | 14.9 | 83 |

Four concurrent pages, 15 s: 1.9–2.0 fps per page before, 3.6–3.7 after (≈1.9× throughput). WebKit on the GPU: 60 fps in every configuration, no long tasks. No main-thread long tasks were recorded in these runs; the UI's 1.6–1.9 s tasks appear under 11-page contention, where GPU-process flushes block the main thread. MSAA was the dominant software cost, so `low` now renders without MSAA and without the masked ripple sprites, renders the lightmap only on change (flicker off), and under automation caps at 10 fps. `high` is unchanged.
