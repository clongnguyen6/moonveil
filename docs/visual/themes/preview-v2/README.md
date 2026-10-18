# Phone readability revision — WebKit emulation

Rendered art-costumes `9470ea9655425380fb5a4915a438a53d9e51194f`. **WebKit emulation, not a real device.** 12 original native390×844 PNG screenshots; DPR1, quality high, no retouching. Short run only; browser closed/dev server stopped and lock returned before dev merge. Later adapter changes are not represented by these images.

## Duck before / after

Same seven-seat fixture and native viewport; speaking local camper. Independent runs, so lighting/motion frame and camera settling differ slightly. Open at100%, not fit-to-page.

| View | Before (39e5af9) | After (9470ea9) |
|---|---|---|
| Ring / hat on / seated | [before](../preview-duck/scene-phone-ring-hat-on-day-seated.png) | [after](scene-phone-duck-ring-hat-on-day-seated.png) |
| Plain / hat on / seated | [before](../preview-duck/scene-phone-plain-hat-on-day-seated.png) | [after](scene-phone-duck-plain-hat-on-day-seated.png) |
| Ring / hat off / seated | [before](../preview-duck/scene-phone-ring-hat-off-day-seated.png) | [after](scene-phone-duck-ring-hat-off-day-seated.png) |
| Plain / hat off / seated | [before](../preview-duck/scene-phone-plain-hat-off-day-seated.png) | [after](scene-phone-duck-plain-hat-off-day-seated.png) |
| Ring / hat on / pose board | [before](../preview-duck/poses-phone-ring-hat-on-day.png) | [after](poses-phone-duck-ring-hat-on-day.png) |
| Plain / hat on / pose board | [before](../preview-duck/poses-phone-plain-hat-on-day.png) | [after](poses-phone-duck-plain-hat-on-day.png) |
| Ring / hat off / pose board | [before](../preview-duck/poses-phone-ring-hat-off-day.png) | [after](poses-phone-duck-ring-hat-off-day.png) |
| Plain / hat off / pose board | [before](../preview-duck/poses-phone-plain-hat-off-day.png) | [after](poses-phone-duck-plain-hat-off-day.png) |

Pose boards use the actual Avatar renderer on flat day ground, body0.8 × representative camera0.65 (~41 px base height), 12 px names; both facings, idle/walk/seated, living/ghost, all speaking. Ghost seated* is the real ghost sprite with seated compression applied as a diagnostic; ghosts do not sit in gameplay. Boards are not scene lightmap/night captures. Full earlier day/night/laptop set remains in preview-duck.

## Strengthened looks — seated phone scene

| Capture | Choices / observation |
|---|---|
| [Frog](scene-phone-frog-default-hat-on-day-seated.png) | pine, frogHat, pockets + leaf pack. Raised round eyes are clear and read frog; pack details remain secondary. |
| [Puffer](scene-phone-fish-puffer-hat-on-day-seated.png) | clay, fishHeadgear, no pouch. Contrasting side fins survive; still a small fish hat, not a fully legible fish illustration. |
| [Shark](scene-phone-fish-shark-hat-on-day-seated.png) | slate, fishHeadgear + finPouch. Single dorsal fin breaks hood silhouette; tooth tabs are tiny supporting details. |
| [Robot](scene-phone-robotCat-default-hat-on-day-seated.png) | river, robotHood + utilityPocket. Mechanical tabs/light inserts and side bell survive; reads robotic camper hood, with weaker cat association at phone size. |

No prior scene captures existed for these four looks; no invented before images. Their baseline-to-revision code commits remain separately reviewable.

## Honest read

- Duck ring/plain now differ at a glance in the seated scene. Raised pale tube/lobes and outer duck head remain visible beyond the torso/stump rather than merging into thin yellow waist trim. Hands stay visible. Stumps still occlude legs; these images preserve that scene overlap.
- Orange cap bill is broader and has a visible lower edge. Plain remains a human camper in a duck cap; its thematic read is less strong than ring's duck silhouette and remains for Human review.
- Ghost ring remains faint but its wider contour survives; caps/hair switch correctly. Target name, speaking ring and arcs stay readable in both-facing pose boards.
- Existing nearby-label placement (e.g. Huy/Lan) remains visible in the scene. No scene/layout changes made here. This pass demonstrates improved readability, not final Human acceptance of all themes.

## Evidence / reproduction

manifest.json lists choices, filenames, native dimensions, hashes and pose metadata; no page errors in this run. capture.mjs uses installed Playwright WebKit, actual mountScene with controlled fixture inputs, and actual Avatar/TextureBank for pose boards. Seven seated players; the local speaker is Minh. No image-generation tool, paid assets, installs or new runtime dependencies. Original Moonveil procedural visuals, existing repository terms; local system font rasterization.

Run capture.mjs from the worktree root through scripts/env.mjs only with the browser lock; DUCK_WEBKIT_EXECUTABLE can reference an existing repo-local WebKit pw_run.sh. Never point this script at a newer revision while labeling images9470ea9.
