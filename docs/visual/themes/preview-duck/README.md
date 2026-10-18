# Duck preview — WebKit emulation

Rendered source: art-costumes `39e5af9823fb0d7e1ae5b154716522c8a9973a9e`. **WebKit emulation, not a real device.** 64 untouched PNG screenshots; native pixels, DPR1, quality high. Phone390×844; laptop1440×900. All use sand top, no optional front/back, speaking enabled. No art/runtime changes in this delivery.

## Start here

- [Phone ring, seated](scene-phone-ring-hat-on-day-seated.png) / [plain, seated](scene-phone-plain-hat-on-day-seated.png).
- [Phone ring pose board](poses-phone-ring-hat-on-day.png) / [plain, hat-off board](poses-phone-plain-hat-off-night.png).
- [Night ring ghost](scene-phone-ring-hat-on-night-ghost.png) / [plain ghost](scene-phone-plain-hat-on-night-ghost.png).
- [Laptop ring, seated](scene-laptop-ring-hat-on-day-seated.png).

## File index

Every combination below has all eight suffixes in the second table (8×8=64). `hat-on` = duckCap; `hat-off` = none. Manifest lists each full path, dimensions, hash, pose metadata and capture errors/attempt notes.

| Filename middle | Variant / hat / viewport |
|---|---|
| phone-ring-hat-on | ring / duckCap / 390×844 |
| phone-ring-hat-off | ring / none / 390×844 |
| phone-plain-hat-on | plain / duckCap / 390×844 |
| phone-plain-hat-off | plain / none / 390×844 |
| laptop-ring-hat-on | ring / duckCap / 1440×900 |
| laptop-ring-hat-off | ring / none / 1440×900 |
| laptop-plain-hat-on | plain / duckCap / 1440×900 |
| laptop-plain-hat-off | plain / none / 1440×900 |

| Filename pattern (middle as above) | Shows |
|---|---|
| scene-{middle}-day-idle.png | Actual scene, living local camper idle, speaking |
| scene-{middle}-day-walk-right.png | Actual scene, living walking right, speaking; pose verified moving/right |
| scene-{middle}-day-walk-left.png | Actual scene, living walking left, speaking; pose verified moving/left |
| scene-{middle}-day-seated.png | Actual seven-seat scene, living seated, speaking; includes furniture occlusion |
| scene-{middle}-day-ghost.png | Actual scene, authorized ghost viewer, daylight, speaking |
| scene-{middle}-night-ghost.png | Actual scene, authorized ghost viewer, night lighting, speaking; living hidden in tents |
| poses-{middle}-day.png | Actual Avatar renderer on flat day ground; both facings, six pose rows |
| poses-{middle}-night.png | Same pose diagnostic on flat night ground; no scene lightmap |

Pose rows: living idle/walk/seated; ghost idle/drift/seated compression. Left column faces right; right column faces left. Each uses production textures and pose methods, 0.8 body scale × representative camera0.65 (phone) /0.8 (laptop), 12 px native labels and real ring/arcs. These are **isolated rig diagnostics**, not full-scene captures. Ghost seated* applies seated scale factors to the real ghost sprite: ghosts never sit in gameplay. Living night poses are diagnostic only: living players enter tents at night. Thus impossible gameplay combinations are shown without changing game rules. Static walk frames sample motion, not video.

## Observations

- Names, speaking ring and arcs remain legible in both facings. Ghost keeps cap/leaf and costume outline pale against the real night scene. Hat off restores hair; plain removes the costume ring.
- Costume swim ring is very thin at native phone size; its duck nub sits partly behind the arm. Ring/plain are only subtly different. Do not count this as final ring-readability acceptance.
- Isolated seated geometry leaves hands and legs visible. In the real seated scene, stumps occlude legs/lower rim; side/hand contours and ring merge visually at this scale. Captures preserve the overlap; nothing was retouched or hidden.
- Some adjacent names in the seven-seat scene sit near another camper (e.g. Huy/Lan). Isolated target labels have clearance. This is scene label/layout evidence for its owner, not a costume fix here.

## Reproduce / provenance

`capture.mjs` uses installed Playwright WebKit and Vite modules: actual mountScene with controlled fixture inputs, plus Avatar/TextureBank for diagnostic boards. Native scene camera/lighting remain renderer-owned; rig boards explicitly use flat grounds. No generated image tool, raster repainting, external assets or spend. Original Moonveil procedural visuals / existing repository terms; OS font rasterized locally.

Run from worktree root through scripts/env.mjs while holding the browser lock, first normally then with DUCK_EXTRA=1. DUCK_WEBKIT_EXECUTABLE may point to an already installed repo-local pw_run.sh; no browser download required. Capture driver initially passed an invalid diagnostic state to the dev banner; corrected before supplemental captures, recorded in manifest attemptNotes. Final frames have no page errors. Browser closed and task dev server stopped; lock returned to coordinator.
