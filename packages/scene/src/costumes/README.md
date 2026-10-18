# Costume art against the rig

Owner: art-themes. Only this directory belongs to art; `../rig.ts`, avatar integration and package tests belong to scene. Read the rig before drawing.

## Identity and declared options

Production costume IDs equal wire `OutfitId`, including camelCase `bowCat` and `robotCat`. Six outfit modules cover eight looks through fish/duck variants. No aliases or additional saved look IDs.

Each costume declares `options` copied from its row in `packages/protocol/src/appearance.ts` (foundation-appearance 8599dd4; content matches art-themes CATALOG.md). Keep list order: the first entry is the default. Colors are optional in the interface (omitted = all top colors); production costumes explicitly declare the wire row's restricted colors.

```ts
import type { Costume } from '../rig.ts';
export const bowCat: Costume = {
  id: 'bowCat',
  options: {
    variants: ['default'], colors: ['rose', 'berry'],
    hats: ['catHood', 'none'], fronts: ['fishSling', 'none'], backs: ['none'],
  },
  top: 0xcf7aa8, // fallback only; selected body color wins
  hidesHair: false,
  crownY: (choice) => choice.hat === 'catHood' ? -93 : -75,
  pieces: {
    hoodBack: (ctx) => { /* draw only when ctx.choice.hat === 'catHood' */ },
    front: (ctx) => { /* fish sling only when selected */ },
    hatFront: (ctx) => { /* hood rim, ears, bow only when selected */ },
  },
};
```

Register in `index.ts` under `COSTUMES[costume.id]` and declare options: the adapter dresses only registered costumes with options. Registry lookup accepts own keys only, never inherited names such as toString. `placeholder` remains a dev-only four-layer fixture with explicit singleton options; it is not a production/wire catalog entry.

## Drawing ownership and order

The base draws the body, face and hair (unless suppressed). **Only plain camper gets base hats, scarf and backpack. A costume draws every selected item itself**, even when an item ID is shared with camper (`scarf`). Mushroom's sand scarf is therefore drawn once, in its own front layer.

Piece order: `back` → `hoodBack` → base legs/torso/arms → `front` → base head/hair/face → `hatFront`. All pieces receive `ctx.b`, read-only `ctx.rig`, `ctx.choice`, `ghost`, `seed`, `color()` and `outline()`.

- `choice`: variant, numeric body color, hat/front/back IDs. Toggles are independent; no role inputs.
- Draw through `Brush` only. Production drawing modules import nothing outside this directory except rig types; no Pixi/DOM dependencies.
- Feet (0,0), facing +x. Body/head/arms/legs stay unchanged. Whole-texture flip, breathe, walk/seated squash and ghost tail/alpha/motion belong to scene; no per-frame art logic.
- Paint fills with `ctx.color(design)` and strokes with `ctx.outline(design)`. Outline already shades and ghost-tints; never pass it through color() again. Shared `paint()` in materials.ts follows this rule.
- Stay inside `RIG.box`, including outline width. Keep `RIG.arcsBand` clear on **every layer**, not just headgear. Avoid text/facing-dependent symbols.
- Declare `crownY` for each headgear choice; hat off returns -75. Inspection checks painted bounds including strokes. Scene derives label clearance from the chosen crown.

## Content handoff

All retain base hair under headgear and when headgear is off. Fixed headgear/prop colors stay constant when the player recolors the top.

| ID / variant | Hat; crown on | Front choice | Back choice |
|---|---|---|---|
| bowCat / default | catHood; -93 | fishSling / none | none |
| robotCat / default | robotHood; -84 | utilityPocket / none | none |
| fish / puffer | fishHeadgear; -88 | none | none / finPouch |
| fish / shark | fishHeadgear; -91 | none | none / finPouch |
| frog / default | frogHat; -94 | raincoatPockets / none | leafPack / none |
| duck / ring | duckCap; -92 | none | none |
| duck / plain | duckCap; -92 | none | none |
| mushroom / default | mushroomCap; -89 | scarf / none | woodPack / none |

Every hat list also permits none. Bow/bell/fins/leaf are part of headgear, not extra slots. Fish variant alone chooses puffer/shark; the same optional fin pouch works for either. No round white robot belly, red collar, logos, character replicas, wolf shapes or role cues. Materials are matte canvas/felt/rubber/wood, broad fills and soft outlines.

Duck ring halves are fixed art of `variant: ring`, unaffected by hat/front/back choices. Rear rim/nub sit behind the arm; shallow front rim clears both hand disks and leaves legs/ghost tail visible. Plain removes both halves/nub but keeps identical cap paths, ghost colors and crown. The ring remains a real option; escalate unresolved scene collisions rather than remove it.

## Checks and preview

```sh
node scripts/env.mjs npm run check -w @moonveil/scene
```

Package tests include `src/costumes/**/*.test.ts`. Rig inspection enumerates every declared option combination, living and ghost: box, crown, arcs on all layers, pale fills and outlines. Art tests additionally check independent toggles, human eyes/hands, ring opening/legs/tail, and ring/plain cap equivalence. Node checks do not establish screenshot readability or seated visual acceptance.

Dev page choices: `?outfit=duck&variant=ring&hat=duckCap&color=sand&front=none&back=none&scene=lobby`; use plain, hat=none, scene=ghost or scene=seating as needed.

Browser lock remains with the coordinator until the chat owner's re-check. No browser rendering without the explicit lock. First Human preview: duck ring/plain, living/ghost, both facings, idle/walk/seated, day/night, phone/laptop, hat on/off; name label, speaking ring and arcs clear. Full set follows. Scene's scripts/check-costume.mjs supports choice parameters via --q, but additional phone/night/plain/hat-off coverage is still required.

Original Moonveil procedural art; no purchased/downloaded assets or new runtime dependencies. Construction and verification stay repo-local. Retain the placeholder for seam regressions; its existing scene-owned test depends on it.
