# Name labels vs campfire effects (visual-labels-fire)

Scene dev page, 7 players (front seat's label sits over the flames, as in game UI's picker capture 06090de),
`packages/scene/scripts/labels-fire-check.mjs`. Browser EMULATION (Playwright Chromium), not real devices.
"before" = dev 68c5ef6; "after" = this branch. Each run: day seated, night walk to the tents (2.5 s), ghosts at full night,
at laptop 1440x900 and phone 390x844, quality high and low (JPEG subset here; `labels-fire.json` lists every run).

- `zoom-day-before-above-after.jpg`: before, the fire's glow and a flame cover the front seat's "An"; after, crisp over the flames.
- `zoom-night-ghost-before-above-after.jpg`: before, the ghost's label is behind the flames and darkened by the night light; after, readable (light moonlit tint).
- `*-night-walk.jpg`: before, "An" disappears behind the fire while walking to the tent; after, visible.
- Assertion (after, every view x quality x day/night): `debugLabels()` = stage `world>lighting>nightTint>emissive>fx>labels>vignette`, labels above every effect layer, 7/7 labels in the label layer. Unit test: `test/labels.test.ts` (STAGE_ORDER).
