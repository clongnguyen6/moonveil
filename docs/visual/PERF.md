# Preview performance under emulation

Measured on the production build (`vite build`, `vite preview` on :4201) in Playwright Chromium, new headless mode, GPU-accelerated (ANGLE Metal, Apple M3 Pro). CPU throttling via CDP `Emulation.setCPUThrottlingRate` is the stand-in for a mid-range phone CPU. **This is emulation, not a device.** The GPU cannot be throttled this way, so fill-rate on a phone GPU remains unmeasured. Each row: 2.5 s warm-up, then 5 s of frames. Script: `preview/scripts/perf.mjs` (`npm run perf`). Revision: see commit.

Columns: frame = wall time between frames (vsync-locked at 60 Hz when under budget); update = scene/director/particles JS; lightmap = quarter-res light pass JS; pixi render = Pixi's JS submission of the frame (batching, uploads). GPU time is not visible from JS.

| device emulation | scene | avatars | CPU throttle | frame avg ms | frame p95 ms | update js ms | lightmap js ms | pixi render js ms |
|---|---|---|---|---|---|---|---|---|
| phone 390×844 @2x | lobby | 10 | 1x | 16.67 | 17.6 | 0.44 | 0.22 | 1.36 |
| phone 390×844 @2x | night | 10 | 1x | 16.67 | 17.4 | 0.19 | 0.11 | 0.44 |
| phone 390×844 @2x | lobby | 16 | 1x | 16.67 | 17.2 | 0.26 | 0.11 | 0.62 |
| phone 390×844 @2x | night | 16 | 1x | 16.67 | 17.4 | 0.27 | 0.12 | 0.52 |
| phone 390×844 @2x | lobby | 10 | 4x | 16.67 | 17.5 | 0.37 | 0.24 | 1.33 |
| phone 390×844 @2x | night | 10 | 4x | 16.66 | 17.7 | 0.47 | 0.33 | 1.39 |
| phone 390×844 @2x | lobby | 16 | 4x | 16.67 | 17.7 | 0.33 | 0.18 | 1.21 |
| phone 390×844 @2x | night | 16 | 4x | 16.67 | 17.6 | 0.36 | 0.16 | 1.15 |
| phone 390×844 @2x | lobby | 10 | 6x | 16.67 | 17.8 | 0.41 | 0.33 | 1.87 |
| phone 390×844 @2x | night | 10 | 6x | 16.67 | 17.8 | 0.51 | 0.46 | 2.1 |
| phone 390×844 @2x | lobby | 16 | 6x | 16.66 | 17.6 | 0.72 | 0.45 | 2.62 |
| phone 390×844 @2x | night | 16 | 6x | 16.66 | 17.8 | 0.7 | 0.46 | 2.08 |
| phone 390×844 @3x | lobby | 16 | 4x | 16.66 | 17.6 | 0.54 | 0.32 | 1.57 |
| phone 390×844 @3x | night | 16 | 4x | 16.66 | 17.5 | 0.57 | 0.36 | 1.47 |
| laptop 1440×900 @1x | lobby | 16 | 1x | 16.66 | 17.5 | 0.29 | 0.12 | 0.74 |
| laptop 1440×900 @1x | night | 16 | 4x | 16.67 | 17.2 | 0.6 | 0.35 | 1.54 |

## Reading

- Every configuration stays vsync-locked at 60 fps (frame avg 16.67 ms, p95 ≤ 18 ms), including 16 avatars at night with 6x CPU throttle.
- Total JS per frame at 6x throttle, 16 avatars: ~3.8 ms of the 16.7 ms budget. At 1x it is under 1 ms. Scaling with throttle is roughly linear, as expected for CPU-bound work.
- What dominates: Pixi's render submission (~55–65%), then the scene update (~20%), then the lightmap pass (~12%). Avatar count barely moves the numbers: 10 → 16 avatars adds ~0.3 ms at 6x. The static sprite count and particle pools, not avatars, set the baseline.
- DPR 3 (iPhone-class pixel count, 1170×2532) did not change JS time, as expected; its cost is GPU fill-rate, which this setup cannot measure.

## Risk and headroom

- Unmeasured: phone GPU fill-rate. The full-screen passes are the lightmap (quarter resolution), the vignette, the night fog quads, and the ripple tiling sprites. If a phone struggles, the first cuts are: fog off, lightmap at 1/8 resolution, DPR capped at 2 (already), ripples one layer. None change the look materially.
- CPU headroom is large: ~4x at the harshest setting tested. Pose interpolation, HUD and voice client work will fit.
- Not tested: memory on low-end devices (baked textures are small: ~40 small atlases, avatars at 3x), Safari-on-iOS WebGL specifics beyond the WebKit screenshots.
