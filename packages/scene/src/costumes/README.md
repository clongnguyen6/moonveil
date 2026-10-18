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

## Duck handoff

`duck.ts`, registry ID `duck`: choose `variant: ring | plain`, `hat: duckCap | none`, body color sand/clay, front/back none. Ring halves are fixed variant art, unaffected by hat/front/back choices. Original Moonveil procedural vectors; no external assets or spend.

- `back`: rear ring band + duck nub behind arm. `front`: shallow open rim, with clearance around both hand disks; legs/tail remain visible.
- `hoodBack` / `hatFront`: duck cap, short beak visor, flat leaf. Hair retained under cap and when cap is off. Crown -92 for duckCap, -75 otherwise; headgear stays left of the speaking-arcs band including outline.
- All fill/stroke colors use context mapping; scene retains ghost alpha/tail/motion. No redraw of skin or base limbs.

Choice forwarding/body color/label clearance from af2afd2 are resolved by the visual-costumes merge (includes 51431c8). The package now has a combined check:

```sh
node scripts/env.mjs npm run check -w @moonveil/scene
```

Existing rig tests inspect default choices; duck tests additionally exercise the full 2-variant × 2-color × 2-hat matrix, living/ghost, bounds/crown/arcs, and sample the front path plus stroke against both hand disks. These checks do not establish screenshot readability or pose composition.

Browser lock not requested/held for this implementation. Preview remains pending: both facings; idle/walk/seated; day/night; phone/laptop; living/ghost; hat on/off; labels, ring and speaking arcs clear. Scene owner is queued for the placeholder before this preview.

## Frog / mushroom handoff

- `frog`: `frogHat | none`, `raincoatPockets | none`, `leafPack | none`; pine/moss tops. Crown -94 with hat. Fixed frog eyes and folded lotus pack; no added motion.
- `mushroom`: `mushroomCap | none`, `scarf | none`, `woodPack | none`; bark/pine tops. Crown -89 with hat. Broad irregular cap spots, short sand scarf and three-slat wooden pack.
- Both preserve base hair when hat is off. All choices remain independent; tests include every combination, living/ghost fills and strokes, outline-inclusive bounds/crown/arcs and face/hand clearance. These are node geometry checks, not scene screenshots.
- Scene composition follow-up: `avatar.ts` still paints the legacy scarf whenever `choice.front === 'scarf'`, even for a costume. Mushroom also owns that piece, so it would be painted twice. Scene owner should reserve legacy scarf drawing for the base camper (or delegate only when no costume front handles it); keep legacy camper behavior. Art does not repaint/mask the base scarf to hide this seam issue.

## Fish handoff

Registry ID `fish`, variants `puffer | shark`; one `fishHeadgear | none` selector, `back: none | finPouch`, front none. Body colors clay/sand/slate/river; hats and pouch retain their fixed material colors.

- Puffer: compact sand hat, rounded side fins and broad toy eyes. Crown -88.
- Shark: slate canvas hood, short swept dorsal fin, two blunt felt tabs and toy eyes. Crown -91. Rim/cheek paths preserve the human face; base hair remains available under the hood and when headgear is off.
- Fin pouch: shared compact canvas tail bag, default off, independent of variant/headgear. No long tail or species body.
- Crown falls back to -75 with headgear off. Every color/headgear/pouch combination is checked living/ghost; headgear geometry includes stroke clearance from the arcs and human eyes. Variant-switch test verifies the pouch is unchanged and old pufferHat/sharkHat IDs cannot select conflicting headgear.

Frog, mushroom, puffer and shark are separate art commits. Scene screenshots remain queued behind the rendering lock; node checks do not establish phone-scale or seated visual acceptance.
