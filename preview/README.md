# Moonveil camp preview

Standalone visual preview (PixiJS v8 + Vite + TypeScript). Not wired into the root workspace yet.

## Run

```sh
cd preview && npm install && npm run dev      # http://127.0.0.1:4200
```

Preview panel (top right) switches scenes: Lobby, Seating, Night, Day, Ghost; living/ghost view; auto speakers; ambience; phone framing.
Move with WASD/arrows, hold Space to talk; on touch devices drag anywhere for the joystick.

URL params: `?scene=lobby|seating|night|day|ghost`, `?view=ghost`, `?n=4..16` players, `?cam=fit|tight`, `?panel=0`, `?audio=0`, `?speak=0`.

## Captures

```sh
npm run capture            # writes docs/visual/preview/*.jpg and motion.mp4 (needs the dev server on :4200 and ffmpeg)
npm run capture -- --no-video
```

Uses Playwright's Chromium (new headless mode, GPU-accelerated). All caches stay inside `preview/.cache/`:

```sh
export PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright TMPDIR=$PWD/.cache/tmp
npx playwright install chromium
```

## Layout

- `src/textures.ts` procedural art baked to textures; `src/avatar.ts` camper presets + animation
- `src/world.ts` map layout, depth sort, walkable test; `src/lighting.ts` quarter-res lightmap (multiply)
- `src/particles.ts` fire/smoke/sparks/fireflies/glints/fog; `src/director.ts` phase choreography
- `src/input.ts` keyboard + floating joystick; `src/audio.ts` procedural ambience; `src/ui.ts` DOM HUD
- `scripts/capture.mjs` Playwright capture
