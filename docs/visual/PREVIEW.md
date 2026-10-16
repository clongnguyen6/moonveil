# Camp visual preview (M1) — for direction approval

Run: `npm install` at the root, then `node scripts/env.mjs npm run dev -w @moonveil/scene` → http://127.0.0.1:4200 (dev harness on the fixture stub server; the renderer lives in `packages/scene`, see `packages/scene/README.md`).
All captures are WebKit/browser emulation (Playwright WebKit, the Safari engine, GPU-backed); no real device was used. An earlier round used GPU headless Chromium; the look is the same.

## What it shows

- 2.5D angled camp beside a stream, fixed camera: one tent per player in two rows (three above 10 players), campfire with stump/log seats that widen with the player count, bridge, lantern posts, forest edge, flowing water.
- Lobby: free movement, keyboard (WASD/arrows) on laptop, floating virtual joystick on touch; 10 campers wander with distinct looks (skin, hair, hat, top, scarf/backpack). Up to 16 via `?n=16`.
- Match seating: walk to seats around the fire, seated pose with breathing idle; speaking indicator = pulsing ring at the feet + sound arcs + gold name.
- Night: shared transition (day → dusk → blue/purple night over ~7 s), campers walk to their tents, tent lanterns flare and settle, fireflies, fog, moon glints on the water, embers-level fire. Dawn reverses it.
- Ghosts: pale translucent campers that float (bob, no shadow), keep hat/hair so other ghosts recognise them, trail wisps, cross water/forest freely. Ghost view shows them; living view hides them (same moment captured both ways).
- Ambience (optional, procedural): stream, fire crackle, wind, birds by day, crickets at night.

## Captures (`docs/visual/preview/`)

| File | Size | What |
|---|---|---|
| laptop-day-lobby.jpg | 1440×900 | Lobby, free movement |
| laptop-campfire-seating.jpg | 1440×900 | Day 1 seating, speaking indicator |
| laptop-night-transition.jpg | 1440×900 | ~3.6 s into the night transition (dusk, walking to tents) |
| laptop-night.jpg | 1440×900 | Settled night, everyone in tents |
| laptop-dawn.jpg | 1440×900 | Dawn, leaving tents |
| laptop-ghost-view.jpg / laptop-living-view-same-moment.jpg | 1440×900 | Two ghosts as seen by a ghost; same scene as the living see it |
| laptop-ended-reveal.jpg | 1440×900 | Match over: roles appended to names |
| laptop-16-players-seating.jpg / laptop-16-players-night.jpg | 1440×900 | Density check at 16: wider seat ring, three tent rows |
| phone-portrait-*.jpg | 390×844 @2x, iPhone 13 emulation in WebKit, touch | lobby (fit + tight framing), seating, night, ghost view |
| phone-landscape-*.jpg | 844×390 @2x | lobby, night |
| motion.mp4 | 960×540, ~40 s | lobby walk + emote + talk → seating → night → dawn → ghost drifting |

## Rendering choice: PixiJS v8 (WebGL, WebGPU-capable)

Recommended for production; the preview is built on it so approval carries over.

- Fits the TypeScript client: typed API, tree-shakeable modules, no framework lock-in. HUD stays in DOM (text, accessibility, layout), the scene is one canvas.
- Mobile budget: the whole scene batches into a few draw calls (~450 static sprites, 16 avatars × 6 objects, ~140 particle sprites). Lighting is a quarter-resolution lightmap (ambient colour + additive blobs, multiplied over the scene) instead of full-screen shader filters, which are the usual mobile killer. Measured 60 fps in GPU headless Chromium at 1440×900 and at 390×844 @2x. Mid-range phone not measured (no device); fill-rate is the main cost there (lightmap, vignette, fog quads) and all are cheap or droppable.
- Rejected: Phaser (bundles physics/tilemaps/scene manager we do not need, heavier, its own abstractions over the same WebGL), Three.js (3D pipeline and materials for flat illustrated art; our lighting is cheaper as a 2D lightmap), Canvas2D (no batching, blend-mode lighting and particles become CPU-bound with 10–16 animated avatars), DOM/CSS (hundreds of animated layers and no multiply/additive compositing).
- Trade-offs: no scene editor or tilemap tooling (the map is laid out in code; fine for one map, would need a small data file for more), filters must be used sparingly on phones, text in-canvas is rasterised (name labels are scaled per device to stay crisp).

## Representative vs placeholder

Representative of the intended final: map composition and scale, day palette, lighting model and night palette, fire/smoke/sparks/fireflies/water motion, avatar proportions and motion (walk bob, breathing idle, seated, ghost float), speaking indicator, night/dawn choreography and timing, ghost treatment, HUD style, joystick behaviour, phone framing.

Placeholder: all art is simple procedural shapes (final: illustrated sprites with more variety in trees, tents, props, and more avatar options); emotes use OS emoji; ambience is synthesised (final: recorded/licensed loops); no sky or visible moon (only its light); HUD copy/icons; no hand-raise, vote or night-action UI; name labels can overlap when players cluster.

## Open visual questions

1. Phone portrait framing. "Fit" keeps the camera fully fixed but the camp is small and half the screen is forest. "Tight" zooms in and softly follows you (camera still fixed on laptop and landscape). Captures of both. Recommendation: tight on portrait phones. Decide.
2. Night darkness: current level is readable on phone; darker is moodier but risks phone-outdoors legibility.
3. One tent per player (current, two rows) vs fewer shared tents. At 16 players, 16 tents need a third row or a wider arc.
4. Name labels always on, or only for speakers/hover/nearby (overlap at 10–16).
5. Ghost look: pale blue, translucent, wisps, visible name. Distinct enough? Too playful?
6. Emotes: OS emoji vs drawn icons in the avatar style.
7. Camera angle: current ellipse ratio ≈ 0.6 (moderately top-down). Flatter shows more of the tents/characters, steeper shows more of the ground layout.
