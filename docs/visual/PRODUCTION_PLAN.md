# Production art, animation and audio: plan (not started)

Status: PLAN, written 2026-10-16 while the visual direction decision is pending. Nothing here is approved or scheduled. It assumes the preview direction (illustrated camp, 2.5D fixed camera, procedural lighting) is approved as-is; open questions in `PREVIEW.md` change scope where noted. Effort is for capable agents working continuously, with WebKit/Chromium emulation only (no real devices).

## Scope

In: everything the player sees and hears in the camp scene and the transitions between phases. Out: HUD/panels (UI owner), rules, voice transport.

| Area | Stays procedural | Becomes authored | Notes |
|---|---|---|---|
| Ground, stream, paths | base layers procedural | authored ground texture tiles (grass, dirt, bank) + water normal/ripple texture | authored = drawn by an agent as SVG/PNG, committed, licence: original |
| Trees, bushes, rocks, props | placement + sway | sprite sheets: 3 pine, 2 round, 2 bush, 3 rock, stump, log, lantern, bridge, fire pit | one style sheet, consistent outline/shading |
| Tents | placement, colour per tent | one tent sprite with mask for colour; door open/closed states; lantern glow | 2 variants if cheap |
| Avatars | baking pipeline, colour catalog | parts library (body, 5 skins, 6 hair, 6 hats, 3 extras) drawn once each; expressions (neutral, talk, surprise) | keep role independence by construction |
| Animation | idle/breathe, walk bob, ghost float, sway, fire, water, fireflies, fog | authored: walk cycle (4 frames) and sit/stand, hand-raise, 4 emote glyphs in the avatar style | procedural keeps file size and effort down |
| Lighting | lightmap, day/dusk/night, lanterns, moon | a sky strip and moon only if the camera angle question goes "flatter" | otherwise no change |
| Audio | stream, fire, wind, crickets, birds (synth) | authored or CC0 loops only if the synth mood is rejected; UI cues belong to the UI owner | licence check per file |
| Transitions | night/dawn choreography | end-of-match reveal moment, elimination moment (ghost rises from seat) | both short, reuse existing systems |

## Ordering (each step ends with regenerated captures for review)

1. Style sheet and avatar parts library (the look everyone else keys off). 2 agent-days.
2. Props and tents in the sheet style; swap into `textures.ts` behind the same `Baked` interface. 1.5 agent-days.
3. Ground, stream and bank textures; tune lightmap against them. 1 agent-day.
4. Avatar animation: walk cycle, sit/stand, expressions, emotes; speaking indicator in style. 1.5 agent-days.
5. Moments: elimination (seat → ghost), end reveal, night/dawn polish (lantern flicker, tent flap). 1 agent-day.
6. Audio pass: keep synth where accepted, replace where not; per-phase mix and ducking during speech. 0.5 agent-day.
7. Phone pass: label legibility, tight-camera tuning, 16-player density, perf re-measure (WebKit; throttled Chromium only under a sandbox that cannot write outside the repo). 1 agent-day.

Total: about 8.5 agent-days of focused work, plus review loops with Human. Steps 1 to 3 are sequential; 4 to 6 can run in parallel after 1; 7 last.

## Constraints that do not change

- Appearance never encodes role. Authored parts stay in the public catalog chosen in the lobby.
- Only original or freely licensed assets, each recorded in `ASSETS.md` with source and licence.
- Keep committed media small: sprite sheets as PNG with palette where possible, captures as JPEG, one video.
- Everything bakes at runtime from sheets or vectors; no per-device asset variants.

## Decisions that change the plan

- Phone framing (fit vs tight): tight is assumed; fit would add a label-decluttering step.
- Night darkness and camera angle: steeper/flatter changes tent and avatar proportions in step 1; decide before it.
- Tents per player vs shared: shared would add a tent-door assignment UI question (UI owner) and simplify step 2.
- Emotes: OS emoji (no work) vs drawn glyphs (in step 4).
