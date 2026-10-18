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
| fish / shark | fishHeadgear; -96 | none | none / finPouch |
| frog / default | frogHat; -94 | raincoatPockets / none | leafPack / none |
| duck / ring | duckCap; -92 | none | none |
| duck / plain | duckCap; -92 | none | none |
| mushroom / default | mushroomCap; -89 | scarf / none | woodPack / none |

Every hat list also permits none. Bow/bell/fins/leaf are part of headgear, not extra slots. Fish variant alone chooses puffer/shark; the same optional fin pouch works for either. No round white robot belly, red collar, logos, character replicas, wolf shapes or role cues. Materials are matte canvas/felt/rubber/wood, broad fills and soft outlines.

Duck ring halves are fixed art of `variant: ring`, unaffected by hat/front/back choices. Rear rim sits behind the torso; broad raised front tube and outer lobes clear both hand disks and leave legs/ghost tail visible. The duck head is attached outside the arm. A brighter cream tube separates the ring from the sand/clay shirt; width uses the inspection box rather than the earlier 52-unit concept target. Plain removes both halves/nub but keeps identical cap paths, ghost colors and crown. The ring remains a real option; escalate unresolved scene collisions rather than remove it.

## Checks and preview

```sh
node scripts/env.mjs npm run check -w @moonveil/scene
```

Package tests include `src/costumes/**/*.test.ts`. Rig inspection enumerates every declared option combination, living and ghost: box, crown, arcs on all layers, pale fills and outlines. Art tests additionally check independent toggles, human eyes/hands, ring opening/legs/tail, and ring/plain cap equivalence. Node checks do not establish screenshot readability or seated visual acceptance.

Dev page choices: `?outfit=duck&variant=ring&hat=duckCap&color=sand&front=none&back=none&scene=lobby`; use plain, hat=none, scene=ghost or scene=seating as needed.

Browser lock remains with the coordinator until the chat owner's re-check. No browser rendering without the explicit lock. First Human preview: duck ring/plain, living/ghost, both facings, idle/walk/seated, day/night, phone/laptop, hat on/off; name label, speaking ring and arcs clear. Full set follows. Scene's scripts/check-costume.mjs supports choice parameters via --q, but additional phone/night/plain/hat-off coverage is still required.

Original Moonveil procedural art; no purchased/downloaded assets or new runtime dependencies. Construction and verification stay repo-local. Retain the placeholder for seam regressions; its existing scene-owned test depends on it.


## Phone readability revision — duck

Current captures at 39e5af9 are an in-progress checkpoint: the original thin ring failed phone readability. New ring geometry spans about 74 units including the bill, with a 7-unit central front tube at y≈-34..-27, raised above the seat's main occlusion area. Outer lobes remain outside the torso/stump silhouette; head/bill moved to the near outer edge. Cap bill is broader and deeper, with a distinct lower lip. Node checks protect hands, legs, face, arcs, bounds, pale ghosts and plain/ring equivalence. These are structural improvements, not a claim of phone acceptance: short locked seated/pose re-capture still required.

Frog readability revision: eye bumps grow from radius6.5 to7.5; cream sockets from4 to5.3 and pupils from1.8 to2.4. Crown remains -94; eye caps stay inside the arcs clearance. Existing full option/ghost/face tests cover the change. Phone visual acceptance remains pending.

Puffer readability revision: broad ember felt fins replace thin sand flaps. Fins project above the speaking-arcs band; all declared combinations remain clear. The art test helper now checks each painted/stroked shape against the actual band (matching rig inspection), rather than forbidding all headgear wider than20 units even above that band. Crown remains -88; phone read still needs screenshots.

Shark readability revision: wider/taller single swept dorsal fin with a broad cream seam; chosen crown is now -96 (still inside the box including strokes). Human face and hood aperture are unchanged. Node checks pass all fish choices; screenshot validation remains pending.

Robot readability revision: mechanical tabs widen from5 to7 units with larger light inserts; brass bell radius grows from3.2 to4.2. Crown/arcs/face constraints unchanged. Bow ears/bow and mushroom cap/spots already use broad features; no speculative redraw for those looks before their phone captures.
