# Production costume catalog

All six themes, shark and both ducks approved. Supersedes README.md selection questions. Creative/assets: art-themes owner. No further concept gate.

## Content IDs and options

Stable content IDs; foundation owns wire schema, scene owner owns layer interface. Defaults: first color, headgear/accessory on.

| Look ID | Display name | Body colors (default first) | Headgear toggle includes | Accessory toggle includes |
|---|---|---|---|---|
| `bow-cat` | Bow cat | rose / berry | Oatmeal cat hood + berry bow | Fish sling + strap |
| `robot-cat` | Robot cat | river / slate | Blue mechanical-tab hood + brass bell | Rectangular utility pocket |
| `pufferfish` | Chubby fish | clay / sand | Ochre puffer hat + small fins | None |
| `shark` | Goofy shark | slate / river | Slate-blue shark hood + dorsal fin + tooth tabs | Tail-shaped canvas pouch |
| `camping-frog` | Camping frog | pine / moss | Moss frog-eye rain hat | Lotus leaf backpack |
| `duck-ring` | Yellow duck · ring | sand / clay | Yellow beak cap + flat leaf | Ring is integral to this ID |
| `duck` | Yellow duck | sand / clay | Same beak cap + leaf | None |
| `forest-mushroom` | Forest mushroom | bark / pine | Red mushroom cap + cream spots | Woodland kit: scarf + wood pack together |

Headgear off restores hair; accessories stay independent. No cross-theme mixing. Colors affect top/coat only; hats/props keep fixed palettes. Preserve independent skin/hair choices. Pocket/scarf/strap are front items.

Ring option switches `duck-ring` ↔ `duck`, retaining color/headgear; no separate ring boolean. Ring persists on `duck-ring` with hat off and as ghost. Other toggles independent. Names may change; IDs never repurposed.

## Palette / materials

| Key | Hex | Use |
|---|---|---|
| rose / berry | #cf7aa8 / #c44f6e | Cat tops; berry bow |
| river / slate | #3e9fc4 / #6d7f94 | Robot/shark tops; robot hood river, shark hood slate |
| clay / sand | #e08a3c / #e0b23c | Fish/duck tops; sand fish hat, duck cap/ring and bell |
| pine / moss | #3f8f7a / #6aa84f | Frog tops; moss hat, pine leaf packs |
| bark / ember | #b07d4f / #d9603b | Mushroom top/wood pack; ember mushroom cap |
| oatmeal / charcoal | #e9e0c8 / #2a2a30 | Hood rims, tooth tabs, spots/scarf; feature dots |

Cat hood oatmeal, fish bag clay; robot pocket slate with oatmeal edge; shark pouch slate with oatmeal seam; duck beak clay/leaf pine; mushroom scarf sand. Existing trousers/skin/hair unchanged. Matte canvas/felt/rubber/wood, broad fills, one highlight, current soft 2-unit outline. No logos, character replicas, wolf shapes or role semantics.

## Ghost palette

Same ID/colors/toggles; scene seam owns ghost treatment. Current-renderer palette: top #c3d4f5, headgear #b9c8ea, accessories/light details #d0dcf5, dark details #a7b8dd; contrasting eye dots. Consume semantic material colors; no local skin recolor, alpha, emission, aura or sound. Scene owns tail/motion/visibility. Preserve ring hole, fins/ears and pack contour.

## Shark construction

See [shark-construction.svg](shark-construction.svg): editable vector construction drawing, not generated raster art. Coordinates are current avatar local units, feet (0,0), facing right. Base head radius 15 at (0,-60), torso 32×34, arms/hands/legs unchanged.

- Headgear back: oval canvas hood centered (0,-61), radii (20,21). Short swept dorsal fin above rear crown; rounded tip (-9,-89), base (-12,-79)→(2,-79). No pointed ears, snout, full shark body or long tail.
- Headgear front: narrow matching rim around the face opening centered (0,-60), radius 16. Two cream felt tooth tabs near (-8,-72) and (3,-72), rounded ends at y=-69. Human eyes/mouth stay exposed. Two sewn toy-eye buttons on crown at (-8,-78)/(7,-78); these are costume details.
- Back item: small tail-shaped pouch, envelope x[-25,-12], y[-44,-27], two rounded lobes. No front item. Hood and pouch are separate toggles; body/top uses selected color.
- Include outlines inside target costume bounds x[-26,22], y[-90,-26]. All shapes flip/squash with the seam; fixed fins/tabs, no secondary animation. One fin and two blunt tabs carry the shark read; gill/zip details are unnecessary at 41 px.
- Hood hides hair only through the seam's headgear behavior. No face repaint or costume-specific ghost logic. Construction drawing includes a pale variant; live renderer validation remains pending.

## First implementation: duck with ring + ghost

After seam handoff, branch from supplied SHA; code only in `packages/scene/src/costumes/**`. Scene owner retains ghost/motion/labels and other scene code; foundation owns wire/server; UI owns picker.

Ring: shallow open torus, rear rim behind torso, front below hands, side duck nub. Target width ≤52 units, front y[-20,-14]; legs visible. Cutouts around hands (±17,-22), radius ≥5. Starting dimensions require seated verification. Preserve hole/split in ghost. Adjust curvature/gaps/nub to retain ring; escalate unresolved collisions, never drop it.

Acceptance with scene owner: both facings; idle/walk/seated; day/night; living/ghost; headgear off; ~41 px body; name/ring/arcs clear. Browser scene rendering requires Human permission. No runtime, wire or UI changes in this commit.

Provenance: original Moonveil procedural SVG, based on current avatar geometry and this construction specification; no downloaded assets, image-tool call, installation, spend or out-of-repo writes. Existing repository terms apply; no separate asset licence added.
