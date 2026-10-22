# Cute Halloween — creative palette / preview

Source reviewed: scene `visual-halloween` b36b06d, `halloween.ts` + `halloween-layout.ts`. Keep its camping map, current campers/costumes and static-first structure. This is concept direction, pending owner review; no gameplay changes.

| Material | Hex | Use |
|---|---|---|
| Pumpkin | #f08a24 / #c9661b / #ffb35a | body / shaded rib / broad highlight |
| Stem / unlit carving | #6b8a3a / #4a2412 | friendly closed eyes, small smile, some plain pumpkins |
| Pumpkin candle | #ffd36b | contained aperture, small local warm pool; never another speaking halo |
| Orange / purple bulbs | #ffa040 / #b07ae8 | sparse warm-majority strands; purple is an accent |
| Wire | #3a2e2a | thin matte cord behind activity |
| Ornament cloth | #fff5e6 / #efdcc4 / #a88a6e | warm ivory / shade / seam |
| Ornament eye / blush / bow | #3a2a2a / #f4a29a / #f08a24 | dot eyes, optional blush, fixed orange bow |
| Dry leaves | #d9772a / #b0582a / #e3a838 | rust / brown / ochre; perimeter clusters |
| Plum night accent | #302436 | night shadow accent; retain green vegetation and blue stream |
| UI page / panel / raised panel | #211b29 / #302638 / #3e3048 | opaque dark plum surfaces, day and night |
| UI text / secondary text | #fff5e6 / #d8c8de | readable labels; do not use bulb purple for body text |
| UI border / focus | #806d8b / #ffd36b | border; high-contrast keyboard focus |
| UI action / ink | #ffb35a / #241728 | amber primary button with dark text |
| Real ghost reference | #c3d4f5 / #a7b8dd | existing pale-blue camper treatment; scene remains authoritative |

## Scale and placement

- Camper baseline ~80 local units; ~41 px tall in phone scene. Preserve current body and costume proportions, names, outlines, speaking arcs/rings.
- Pumpkin body ~28×20 units (~14×10 px relative to camper), stem to 26 units. 4–6 scattered around OUTSIDE the occupied seat ellipse, not a replacement seat. Two or three plain pumpkins at tent sides are enough. Keep at least existing 52-unit seat-centre exclusion, 30/18 ellipse margins; enlarge exclusions if projected pixels collide.
- Ornament: warm ivory sheet body 18×22 units, ~9×11 px at this scale; thread adds 10 units. Orange bow, scalloped hem, no arms, camper head, tail, aura or wisps. Attached to a back-row cord/stake, never free-roaming. Max two visible. Real ghost ~41 px with recognisable camper head/arms/costume, pale-blue tail/wisps and player name. Comparison is an explanatory specimen, not permission to expose ghosts to living players.
- At most two back-row strands, 4–8 bulbs each. Prefer 2 orange : 1 purple (a proposed refinement of the current alternating pattern). Bulb ~2–3 px at phone scale, no broad bloom. Do not string cords across the campfire/seat ring, avatar heads or tent doors.
- Leaves 3–6 px, grouped near forest/tent edges. Refine current up-to-150 scattered placements to 30–60 sparse leaves in 5–8 clusters; preserve existing clear fire dirt, paths and stream. No leaf confetti over players.
- No decoration, glow, wire or UI flourish may overlap names, speaking rings/arcs, seat surfaces, tent-door travel lanes, bridge, stream crossings or action controls. Ground decals alone are insufficient to guarantee clearance: assess projected screen boxes at phone size. Labels remain on top, but decoration must also leave visual quiet behind them.

## Refinements / restraint

Keep existing pumpkin and cloth colours. Lead with amber, use purple sparingly; plum belongs in night shadows and UI surfaces, not a global purple wash. Keep river blue and day grass green. Pumpkin light below campfire brightness. Plain pumpkin variants prevent every object looking like a face. No role symbolism, skulls, fangs, gore or scares.

Low/reduced motion: static baked props, fixed bulb fills and candle apertures. No particles or dependency on flicker, sway, fog, twinkle or real-time lights for recognition. Optional high-profile motion stays slow/subtle; no flashing. UI layout, actions and gameflow unchanged.
