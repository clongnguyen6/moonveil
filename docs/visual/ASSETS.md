# Visual preview: asset and license record

Everything rendered by the preview is generated at runtime. No image, audio, font or model files are committed or downloaded.

| Asset | Source | License |
|---|---|---|
| Scenery (trees, tents, rocks, stumps, logs, bridge, lantern posts, fire pit, grass, flowers, ground, stream) | Procedural, `preview/src/textures.ts`, `preview/src/world.ts` | Original (Moonveil) |
| Avatars (12 presets + random variants) | Procedural, `preview/src/avatar.ts` | Original (Moonveil) |
| Lights, flames, smoke, sparks, fog, ripples, vignette | Canvas2D gradients / Pixi Graphics, `preview/src/textures.ts` | Original (Moonveil) |
| Ambience (stream, fire, wind, birds, crickets) | Web Audio synthesis, `preview/src/audio.ts` | Original (Moonveil) |
| UI font | System font stack (ui-rounded / SF Pro Rounded / Segoe UI / system-ui) | OS-provided, not bundled |
| Emote glyphs (👋 🤔 😄 👍) | OS emoji font via Pixi Text | OS-provided, not bundled; placeholder |

Dependencies (npm, not committed): pixi.js 8.22.0 (MIT), vite 8.3.4 (MIT), typescript 7.0.2 (Apache-2.0), @playwright/test 1.64.1 (Apache-2.0). Playwright downloads Chromium (BSD-style licenses) into the gitignored `preview/.cache/ms-playwright`.

Captures in `docs/visual/preview/` were produced by `preview/scripts/capture.mjs` from this code; ffmpeg (system binary, already installed) transcoded the video.
