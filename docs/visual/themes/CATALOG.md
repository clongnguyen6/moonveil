# Production costume catalog

All six themes, shark and both ducks approved. Supersedes README.md selection questions. Creative/assets: art-themes owner. No further concept gate.

## Contract-aligned content (foundation c913147)

Source for catalog lists in the proposed `{ outfit, variant, color, hat, front, back, body? }` contract. Foundation owns implementation/validation. This replaces the earlier document-only flat IDs; no shipped IDs change. Eight looks are identified by `(outfit, variant)`, not an additional saved look ID.

| Stable outfit / variant | Display name | Headgear when enabled |
|---|---|---|
| `bowCat / default` | Bow cat | Oatmeal cat hood + berry bow |
| `robotCat / default` | Robot cat | Blue mechanical-tab hood + brass bell |
| `fish / puffer` | Chubby fish | Ochre puffer hat + small fins |
| `fish / shark` | Goofy shark | Slate-blue shark hood + dorsal fin + blunt tooth tabs |
| `frog / default` | Camping frog | Moss frog-eye rain hat |
| `duck / ring` | Yellow duck · ring | Yellow beak cap + flat leaf |
| `duck / plain` | Yellow duck | Same beak cap + leaf |
| `mushroom / default` | Forest mushroom | Red cap + cream spots |

### Authoritative OUTFITS lists

First entry is default; singleton lists are not choosable. Existing `camper` lists from the proposal stay unchanged. All IDs below are literal content keys; foundation may transcribe this JSON directly.

```json
{
  "camper": { "variants": ["default"], "colors": ["ember", "moss", "river", "dusk", "sand", "berry", "pine", "slate", "clay", "sky", "bark", "rose"], "hats": ["none", "beanie", "cap", "bucket", "flower", "hood"], "fronts": ["none", "scarf"], "backs": ["none", "backpack"] },
  "bowCat": { "variants": ["default"], "colors": ["rose", "berry"], "hats": ["catHood", "none"], "fronts": ["fishSling", "none"], "backs": ["none"] },
  "robotCat": { "variants": ["default"], "colors": ["river", "slate"], "hats": ["robotHood", "none"], "fronts": ["utilityPocket", "none"], "backs": ["none"] },
  "fish": { "variants": ["puffer", "shark"], "colors": ["clay", "sand", "slate", "river"], "hats": ["fishHeadgear", "none"], "fronts": ["none"], "backs": ["none", "finPouch"] },
  "frog": { "variants": ["default"], "colors": ["pine", "moss"], "hats": ["frogHat", "none"], "fronts": ["raincoatPockets", "none"], "backs": ["leafPack", "none"] },
  "duck": { "variants": ["ring", "plain"], "colors": ["sand", "clay"], "hats": ["duckCap", "none"], "fronts": ["none"], "backs": ["none"] },
  "mushroom": { "variants": ["default"], "colors": ["bark", "pine"], "hats": ["mushroomCap", "none"], "fronts": ["scarf", "none"], "backs": ["woodPack", "none"] }
}
```

### Choice semantics / proposal changes

- **Fish choice lives only in `variant`.** Replace `pufferHat`/`sharkHat` with `fishHeadgear`; it draws the selected variant's headgear. `none` removes that entire group. No puffer/shark hat cross-product or variant-specific list validation needed.
- Fish deliberately shares four top colors and optional `finPouch` across both variants. Pouch is a compact tail-shaped canvas bag, valid for either fish; default off. All fish combinations are intentional. Shark construction drawing uses explicit `color: slate`, `back: finPouch`; canonical default for either variant is clay/no pouch.
- Add `none` after every costume headgear default. Bow/bell/fins/leaf belong to headgear, not extra slots. Headgear off restores hair; accessories remain independent.
- Restrict bow colors to rose/berry; robot to river/slate; mushroom to bark/pine. Frog/duck colors and existing accessory IDs stay as proposed. Global COLORS/SKINS/HAIRS/HAIR_COLORS stay unchanged. Keep legacy hat/accessory IDs; add `fishHeadgear` and `finPouch`, omit the two placeholder fish hat IDs.
- **No fourth choosable slot.** `hat`, `front`, `back` cover everything. Mushroom scarf/wood pack are now independent, replacing the earlier bundled kit. Frog pockets/leaf pack likewise independent. No cross-theme mixing.
- Duck ring halves are fixed art of `duck / ring`, not front/back choices. `front: none, back: none` means no optional accessories; it does not remove the fixed ring. It persists with hat off and as ghost. `duck / plain` omits both halves. A ring toggle changes only `variant`, retaining color/hat.
- Colors affect only top/coat; headgear/props use fixed palettes below. Preserve `body?` semantics; no new body controls or wire fields requested. Names may change; content keys must not be repurposed.

## Palette / materials

| Key | Hex | Use |
|---|---|---|
| rose / berry | #cf7aa8 / #c44f6e | Cat tops; berry bow |
| river / slate | #3e9fc4 / #6d7f94 | Robot/shark tops; robot hood river, shark hood slate |
| clay / sand | #e08a3c / #e0b23c | Fish/duck tops; sand fish hat, duck cap/ring and bell |
| pine / moss | #3f8f7a / #6aa84f | Frog tops; moss hat, pine leaf packs |
| bark / ember | #b07d4f / #d9603b | Mushroom top/wood pack; ember mushroom cap |
| oatmeal / charcoal | #e9e0c8 / #2a2a30 | Hood rims, tooth tabs, spots/scarf; feature dots |

Cat hood oatmeal, fish bag clay; robot pocket slate with oatmeal edge; fish fin pouch slate with oatmeal seam; duck beak clay/leaf pine; mushroom scarf sand. Existing trousers/skin/hair unchanged. Matte canvas/felt/rubber/wood, broad fills, one highlight, current soft 2-unit outline. No logos, character replicas, wolf shapes or role semantics.

## Ghost palette

Same ID/colors/toggles; scene seam owns ghost treatment. Current-renderer palette: top #c3d4f5, headgear #b9c8ea, accessories/light details #d0dcf5, dark details #a7b8dd; contrasting eye dots. Consume semantic material colors; no local skin recolor, alpha, emission, aura or sound. Scene owns tail/motion/visibility. Preserve ring hole, fins/ears and pack contour.

## Shark construction

See [shark-construction.svg](shark-construction.svg): editable vector construction drawing, not generated raster art. Coordinates are current avatar local units, feet (0,0), facing right. Base head radius 15 at (0,-60), torso 32×34, arms/hands/legs unchanged.

- Headgear back: oval canvas hood centered (0,-61), radii (20,21). Short swept dorsal fin above rear crown; rounded tip (-9,-89), base (-12,-79)→(2,-79). No pointed ears, snout, full shark body or long tail.
- Headgear front: narrow matching rim around the face opening centered (0,-60), radius 16. Two cream felt tooth tabs near (-8,-72) and (3,-72), rounded ends at y=-69. Human eyes/mouth stay exposed. Two sewn toy-eye buttons on crown at (-8,-78)/(7,-78); these are costume details.
- Back item: optional `finPouch`, shared with puffer; small tail-shaped pouch, envelope x[-25,-12], y[-44,-27], two rounded lobes. No front item. Hood and pouch are separate toggles; body/top uses selected color.
- Include outlines inside target costume bounds x[-26,22], y[-90,-26]. All shapes flip/squash with the seam; fixed fins/tabs, no secondary animation. One fin and two blunt tabs carry the shark read; gill/zip details are unnecessary at 41 px.
- Hood hides hair only through the seam's headgear behavior. No face repaint or costume-specific ghost logic. Construction drawing includes a pale variant; live renderer validation remains pending.

## First implementation: duck / ring + ghost

After seam handoff, branch from supplied SHA; code only in `packages/scene/src/costumes/**`. Scene owner retains ghost/motion/labels and other scene code; foundation owns wire/server; UI owns picker.

Ring: shallow open torus, rear rim behind torso, front below hands, side duck nub. Target width ≤52 units, front y[-20,-14]; legs visible. Cutouts around hands (±17,-22), radius ≥5. Starting dimensions require seated verification. Preserve hole/split in ghost. Adjust curvature/gaps/nub to retain ring; escalate unresolved collisions, never drop it.

Acceptance with scene owner: both facings; idle/walk/seated; day/night; living/ghost; headgear off; ~41 px body; name/ring/arcs clear. Browser scene rendering requires Human permission. Catalog only; no runtime, wire or UI implementation changes.

Provenance: original Moonveil procedural SVG, based on current avatar geometry and this construction specification; no downloaded assets, image-tool call, installation, spend or out-of-repo writes. Existing repository terms apply; no separate asset licence added.
