# @moonveil/scene

Camp renderer (PixiJS v8). A pure function of three inputs: the seat's `SceneInput` snapshot, server-filtered `PoseFrame`s, and local input. It never holds data the seat may not see. See `docs/visual/INTEGRATION.md`.

## Exports

- `@moonveil/scene`: `mountScene(host, { input })` → `SceneHandle` (`setInput`, `setPoses`, `setSpeaking`, `on('move'|'emote')`, `setSpeakingLocal`, `setAudio`, `setCamera`, `setSafeArea`, `destroy`). Types: `SceneInput`, `Pose`, `SceneAppearance`, catalogs. Helpers: `intentFor`, `canMove`, `appearanceFromProtocol` (provisional `{color, hat}` adapter).
- `@moonveil/scene/map`: DOM-free layout (`createMap(playerCount)`), `isWalkable(map, x, y)`, `inWorld`, constants. For the server to validate `move` messages with the renderer's geometry.
- `@moonveil/scene/fixtures`: `makeInput(scene, n)`, `FakeServer` (stub server: NPC movement, entitlement-filtered poses, speaking rotation). Used by the dev harness and tests.

## Run

```sh
npm install                                             # at the repo root (workspace)
node scripts/env.mjs npm run dev -w @moonveil/scene     # harness on http://127.0.0.1:4200
node scripts/env.mjs npm test -w @moonveil/scene        # node:test, pure modules only
node scripts/env.mjs npm run typecheck -w @moonveil/scene
```

Harness URL params: `?scene=lobby|seating|night|day|ghost|ended`, `?n=4..16`, `?viewer=moderator|s1..s16`, `?cam=fit|tight`, `?panel=0`, `?audio=0`, `?speak=0`, `?perf=1`. Keyboard WASD/arrows, Space to talk; touch: drag anywhere for the joystick.

## Captures and perf (Playwright WebKit, grant b)

```sh
node scripts/env.mjs npx playwright install webkit                                   # once, into root .cache/
node scripts/env.mjs node packages/scene/scripts/capture.mjs [--no-video] [--only x] # harness on :4200 → docs/visual/preview/
node scripts/env.mjs npm run build -w @moonveil/scene && node scripts/env.mjs npm run preview -w @moonveil/scene   # :4201
node scripts/env.mjs node packages/scene/scripts/perf.mjs                            # → docs/visual/PERF.md table
node scripts/env.mjs node packages/scene/scripts/smoke.mjs webkit|shell [scene]      # quick render + fps check
```

Full Chrome for Testing is not used: it writes outside the repo (`~/Library/Preferences/com.google.chrome.for.testing.plist`, Crashpad). WebKit writes only to its three granted `org.webkit.Playwright` paths.

## Layout

`src/map.ts` layout + walkability (pure) · `src/choreo.ts` per-seat intent (pure) · `src/poses.ts` interpolation (pure) · `src/appearance.ts` catalog (pure) · `src/textures.ts` procedural art · `src/avatar.ts` · `src/world.ts` · `src/lighting.ts` quarter-res lightmap · `src/particles.ts` · `src/input.ts` keyboard + joystick · `src/audio.ts` procedural ambience · `src/scene.ts` `mountScene` · `dev/` harness + HUD · `fixtures/` stub server · `test/` node tests.

Role independence: appearance is chosen by the player in the lobby and lives in public seat data; the scene has no role field until the end-of-match reveal, which it only appends to the name label.
