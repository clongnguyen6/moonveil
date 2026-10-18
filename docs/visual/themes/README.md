# Costume concepts — review round

Base revision: `origin/dev d44e705`. Branch: `art-themes`. Only this directory changes. No production assets or game/UI/schema changes.

## Review images

- [Concept sheet](concept-sheet.png): current source-derived base + six costumes + themed ghost.
- [Phone day](phone-day.png) / [phone night](phone-night.png): 390 × 440 px; open at 100%.
- [Scale strip](phone-scale-strip.png): day/night, camera 1 and 0.65; open at 100%.
- [Generated master](generated-costumes.png): transparent, unretouched image-tool result.
- [Geometry reference](base-geometry-reference.png): source-derived base used as edit target.
- [Actual camper capture crop](current-capture-reference.png): enlarged from existing capture; compare anatomy.
- [Prompts](PROMPTS.md): exact prompts, including rejected attempts.

Default: source-derived `PRESETS[0]` (light/ember/short black/no accessories); game variants are seat-seeded.

## Palette / materials

Keep Moonveil's existing top swatches: ember #d9603b, rose #cf7aa8, river #3e9fc4, clay #e08a3c, pine #3f8f7a, moss #6aa84f, sand #e0b23c, bark #b07d4f. Add oatmeal #e9e0c8, berry #c44f6e, brass #e0b23c and charcoal trousers. Generated colors are approximate; these swatches govern a later vector build.

Matte canvas, felt bow/fins, coated raincoat, rubber ring, carved wood. Broad fills, one highlight, soft outline. No fine textures or logos. Light skin held constant; keep all existing skin/hair options.

## Buildable layers / field mapping

Order: back item → hood rear → legs → top/arms → scarf/front item → face/hair → hat front. Keep current face and body coordinates.

| Look | Hat/headgear | Back item | Front item | Body/top |
|---|---|---|---|---|
| Bow cat | Oatmeal cat-ear hood; berry bow attached | None | Fish sling + strap | rose |
| Robot cat | River hood; short mechanical tabs; offset brass bell | None | Asymmetric rectangular utility pocket | river |
| Chubby fish | Ochre pufferfish hat; small fins | None | None; avoid detail at this size | clay |
| Camping frog | Moss frog-eye rain hat | Folded lotus leaf pack | Raincoat placket / two broad pockets | pine |
| Yellow duck | Sand beak cap; single flat leaf on crown | Rear half of swim ring | Front half of ring + small duck nub | sand |
| Mushroom | Ember-red low cap, three irregular cream spots | Small wood-slat pack | Short sand scarf | bark |

`skin`, `hair`, `hairColor` retain current meanings. Listed `top` values already exist in the scene. `hat` is the conceptual headgear slot; none of these new IDs exists. Bell/bow/fins belong to that headgear group.

`extra` currently permits only none/scarf/backpack, one at a time. It cannot represent these front/back combinations or the ring. Mushroom needs scarf + pack. Do not overload current IDs or hide outfit state in colors/seat seeds. This is a schema seam for visual/UI/foundation owners after selection, not an implementation proposal approved here.

Wire appearance is still eight colors + six hats. `clay`, `rose`, `bark` and every theme are absent from that wire catalog; `appearanceFromProtocol` cannot round-trip these looks. Save/Cancel already exists and remains outside scope. Lead coordinates an explicit appearance contract before production.

## Size / identity evidence

Current source geometry: head radius15 at (0,-60); torso32 × 34; arms8 × 22; legs16 high; approximately78 units to crown. Generated master was edited over an eight-copy source-derived raster template after two oversized-head attempts were rejected. It follows the base; it is not a pixel-exact replacement for drawAvatar. Production must use the unchanged base geometry.

The master default spans311 image px, normalized to78 world units; no per-costume stretching. Base reference spans313 px and is normalized separately. Costume heights328–359 master px correspond to82–90 world units. Base at body scale0.8: ~62 px at camera1, ~41 px at camera0.65. Hats add ~3–10 px; costumes never replace the human body. Camera0.65 is a representative study, not a universal phone camera measurement.

Labels requested at13 screen px, separate from the body. Source constructor says13, but current `scene.ts:layoutNameLabels` sets12 for <13 seats and11 at13+. At camera<0.65 labelScale also adds0.8. Study deliberately honors requested13, not an exact screenshot of the current label layout.

Ring:52 × 28 world units, stroke3, warm #ffe28a; three speaking arcs radii6/12/18, stroke2.4. Study uses speaking-on midpoint size, not pulse extrema. Body alpha0.78 for ghost, lifted14 units; label lifted a further12 units as in source. Faint frog hat/pack and tail stay identifiable. Labels are normal system semibold with a3 px dark outline approximation; actual Pixi font rasterization differs.

At41 px the hat silhouette separates the looks; pockets, bell details, wood slats and bag eyes are expendable. Name labels and speaking cues carry seat identity when outfits duplicate. No outfit, color or accessory identifies role. Ghost shown for an authorized ghost viewer, not a proposed living-player visibility change.

Day #52763b and night #182c29 are flat ground palette studies informed by existing captures, not sampled runtime lighting. Costumes retain the same local colors across both. No scene render, real phone validation, crowded 7–10 seat layout, camera clipping, night lightmap, flip, movement or seated validation claimed.

## Animation / risks

Current body is a single baked sprite: facing flip; breathe ±1.5%; walking squash ±6% with reciprocal horizontal scale; seated x1.06/y0.86. Keep these transforms on the complete costume first; no independent jiggle required.

- Cat: ears/bow stay attached to hood; short sling keeps bag inside hand envelope. Flip entire shape; no text/asymmetric meaning.
- Robot: bell is silent cosmetic, attached to hood, no pendulum required. Keep beside head rather than across face; check speaking-arc overlap on both facings.
- Fish: fins are rounded and fixed to hat, not arms. Keep away from arcs; squash with body, no flutter required.
- Frog: eye bumps remain above hat; leaf pack behind arm. Leaf contour remains readable when palette is pale.
- Duck: ring split behind/in front of torso for drawing order, baked together. Seated compression can collide with hands or hide legs; cap width near52 units and check seated first.
- Mushroom: broad irregular spots survive minification; cap/scarf/pack move together. Cap-label gap is tight: max90-unit hat at0.8 reaches-72 versus label anchor-78. Check breathe/walk/seated/camera and existing label resolver before accepting dimensions.
- Ghost: later vector build should use existing pale palette on every costume piece, alpha0.78, existing tail/aura/wisps; generated preview retains some face/pack hue. All six themes need ghost checks eventually.

## Production recommendation

Retain procedural Pixi vector layers, baked into existing living/ghost textures. Simple shapes preserve recolor, ghost palette, bounds and motion without extra draw calls, asset loading or dependencies.

Generated rasters are review references; do not slice them into final pieces. Baked hues/antialiasing/anatomy drift complicate recolor and ghosts.

After selection: visual owner builds one look + ghost; verify flip/idle/walk/seated, label/ring clearance and day/night in an authorized browser session. Agree appearance contract before extending catalog.

## Decisions for Human

1. Select which theme(s) and details to carry forward.
2. Fish recommendation: compact pufferfish hat, as shown. Shark alternative omitted because the rounded fin hat reads at41 px and preserves the base.
3. Confirm duck ring width / seated feasibility is worth keeping, or choose cap + leaf only.
4. Keep costume-on-human assumption for production unless a separate species change is explicitly approved.

## Provenance / licence

| Images | Source / tool | Licence / status |
|---|---|---|
| generated-costumes.png | Built-in OpenAI image_gen.imagegen; source-derived base supplied as edit target; final prompt in PROMPTS.md | Generated for Moonveil review under the tool/account terms; no third-party asset licence or separate licence added; no exclusivity/legal-clearance claim |
| exploration-v1.png, exploration-v2.png | Same tool; initial reference-guided generation then correction using capture crop | Same generated-output status; rejected anatomy; not candidates |
| base-geometry-reference.png | Deterministic AppKit/CoreGraphics transcription of current drawAvatar base geometry, eight copies | Original Moonveil source-derived reference; existing repository terms, no new licence assigned |
| current-capture-reference.png | Existing docs/visual/look/after-1-lobby.jpg, crop x540/y556/w52/h84; sips enlargement8× and PNG conversion | Original Moonveil capture per ASSETS.md; existing repository terms |
| concept-sheet.png | Generated master + source-derived default; deterministic AppKit layout, text and simple presentation shadows | Derivative review layout of sources above; no separate licence added |
| phone-scale-strip.png, phone-day.png, phone-night.png | Same master/default; deterministic AppKit crop/scale/layout, native system-font labels and source-derived indicator geometry | Same derivative status; system font rasterized locally, no font file bundled |

Three image-tool calls; exact prompts retained. No franchise imagery or third-party downloads. Human faces, utility details and camping materials; no signature character faces/collars/logos/wolf motifs. Similarity assessment is not legal clearance.

Artwork used the built-in image tool. Layout/typography/pixel sizing used Swift + installed AppKit/CoreGraphics; capture crop used installed sips. No installation, external paid API, signup, purchase, browser automation or game suites. Working scripts and compiler caches were kept under this directory and removed before commit; no runtime code delivered.

Constraint exception: the built-in image tool automatically saved managed originals under its own runtime generated_images directory outside Moonveil despite the prompt asking for repo-local saving. Its API exposes no output-directory control. All project deliverables were copied here. No manual out-of-repo writes or installs were performed; the forbidden folder was never accessed.
