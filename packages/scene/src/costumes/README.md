# Drawing costumes against the rig

Owner of this directory: art-themes. Everything else in `packages/scene` is visual's. The seam is `../rig.ts`; read it first.

## What a costume is

```ts
import type { Costume } from '../rig.ts';
export const bowCat: Costume = {
  id: 'bow-cat',
  top: 0xcf7aa8,           // body/top colour (design colour; the rig maps it for ghosts)
  hidesHair: true,         // hoods cover hair
  hidesHat: true,          // headgear replaces the base hat slot
  crownY: -88,             // highest point your headgear reaches (negative); or (choice) => number when hats differ; the label moves up to clear it
  pieces: {
    back:     (ctx) => { /* behind everything: packs, rear half of the swim ring; branch on ctx.choice.back */ },
    hoodBack: (ctx) => { /* behind the head, over the back item: hood rear, ear backs */ },
    front:    (ctx) => { /* over torso/arms, under the head: pockets, slings, front half of the ring, scarves */ },
    hatFront: (ctx) => { /* over the face: hats, ears, bows, bells, fins; branch on ctx.choice.hat / variant */ },
  },
};
```
Register it in `index.ts` (`COSTUMES[bowCat.id] = bowCat`).

`ctx.choice` carries the player's picks for the outfit (`variant`, `color` as 0xRRGGBB, `hat`, `front`, `back`; catalog ids per the appearance contract); draw the chosen pieces and ignore the rest. The rig derives it from the scene appearance (`outfit`, `variant`, `top`, `hat`, `front`, `back`; legacy `extra` maps onto front/back). The selected `top` colours the body; `costume.top` is only a fallback. A base hat id (`none`, `beanie`, `cap`, `bucket`, `hood`, `flower`) is drawn by the base rig; any other `hat` id is yours to draw in `hatFront` (and `hoodBack`), and `crownY` may be a function of the choice.

Dev page: `?scene=lobby&outfit=duck&variant=ring&hat=duckCap&color=sand&front=none&back=none` dresses every seat with those choices (`&scene=ghost` for ghosts, `&scene=seating` for the seated squash). `npm run check -w @moonveil/scene` runs typecheck and all tests, including `src/costumes/**/*.test.ts`.

## Rules the rig enforces (unit test `test/costumes.test.ts` runs them for every registered costume)

- Draw only through `ctx.b` (the `Brush`: roundRect, circle, ellipse, poly, moveTo/lineTo/quadraticCurveTo/closePath, fill, stroke). No Pixi, no DOM, no imports from outside `costumes/` except `../rig.ts` types.
- Coordinates: base space, feet at (0, 0), facing +x. The rig flips the whole texture for the other facing, so never draw text or anything whose meaning depends on facing.
- Stay inside `RIG.box` (x −40..40, y −96..4). Declared `crownY` must cover the top of what you draw.
- Keep the speaking-arcs band beside the head (`RIG.arcsBand`, x 20..32, y −74..−46) clear of headgear.
- Pass every colour through `ctx.color(c)`: living returns `c`, ghost returns the pale ghost tint. Use `ctx.outline(c)` for the soft outline, matching the base. Avoid pure whites/blacks (ghost palette must stay pale).
- The base body geometry (`RIG`) is read-only: head r15 at (0,−60), torso 32×34, arms 8×22, legs 16 high. Costumes layer on it; they never replace or move it.
- Nothing per-frame: pieces run once per bake (living and ghost), so they can be as detailed as the box allows at no runtime cost. Motion (flip, breathe, walk squash, seated squash) is applied to the baked texture as a whole.

## Checking your work

- `node --test test/costumes.test.ts` (no browser) validates box, arcs band, crown and ghost palette for every registered costume.
- Harness (needs the browser lock): `?scene=lobby&costume=<id>` dresses every seat; `?scene=ghost&costume=<id>` shows the ghost variant; `?scene=seating&costume=<id>` the seated squash.
