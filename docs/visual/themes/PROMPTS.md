# Image generation prompts

## Final: edit source-derived geometry template

Use case: precise-object-edit
Edit target: supplied image is an EIGHT-CAMPER geometry template recreated directly from Moonveil's current drawAvatar source. EDIT THIS IMAGE, DO NOT REDRAW THE CHARACTERS. Preserve its canvas size, eight centers, foot baseline, poses, skin, faces, tiny two right-offset dot eyes, round head diameters, torso widths/heights, arms/hands, trouser lengths, boots and clean flat vector style EXACTLY. Head diameters are120 pixels, torso width128px, total height312px. NEVER make heads larger, NEVER move eyes or reshape faces. Add costumes OVER these existing bodies. Keep all 8 evenly spaced positions. Transparent background.
First character unchanged default orange top, no accessories.
Second: add small oatmeal canvas cat-ear hood AROUND original head without changing face circle; small berry pink bow on one ear; recolor SAME torso rose; add tiny fish-shaped sling bag. No cartoon cat face, whiskers, yellow nose or brand likeness.
Third: add round muted blue cloth hood around original head with SMALL ROUNDED RECTANGULAR mechanical ear tabs, yellow bell on offset side tab; recolor SAME torso river blue, asymmetric rectangular patch pocket; no red collar or white belly, no whiskers or brand likeness.
Fourth: add compact ochre pufferfish HAT above original forehead, small floppy side fins, decorative fish eyes ON HAT; recolor SAME torso clay. No swollen human body, no spikes.
Fifth: add moss hat with raised frog-eye bumps above original forehead, recolor SAME torso pine raincoat, small folded lotus leaf backpack peeking behind left shoulder.
Sixth: add yellow cap with soft orange beak visor above original forehead and ONE FLAT GREEN LEAF laid across crown, not a sprout; recolor SAME torso sand; add thin yellow duck swim ring at waist maximum208px wide with small side head. Hands and legs remain visible.
Seventh: red low mushroom cap above original forehead with3 irregular cream spots, cream underside; short sand scarf; SAME torso bark brown, compact wood slat backpack behind left shoulder.
Eighth: exactly the fifth frog costume, but pale blue faint ghost alpha78%; replace ONLY legs with short scalloped ghost tail. Face circle head, torso and arms stay same.
All costumes must fit ON current campers, not species transformations. All original, no logos, no wolves, no secret-role indicators. Make design shapes simple with current soft dark outline, solid fills, restrained single highlights. No new text, names, rings, ground, backdrop, scenery or shadows. This is a tight production-oriented concept OVERLAY edit, not freedom to reinterpret anatomy.


Built-in `image_gen.imagegen`; transparent background requested. Moonveil-owned references. No paid API fallback or purchased assets.

## Exploration (rejected proportions)

Use case: stylized-concept
Asset type: Moonveil costume concept review sheet, NOT production assets.
Input images: previously viewed Moonveil lobby and phone captures are reference images for the EXACT existing small procedural camper body, flat vector-like style and camping palette. They are not edit targets.
Primary request: Generate ONE wide transparent PNG contact sheet with EIGHT equally spaced full-body campers in ONE horizontal row, all facing right in the same slight three-quarter view, identical pose, same base human silhouette and proportions. No text, no labels, no ground, no rings, no shadows, no scenery. Target 3072x1024. Keep every character completely separated with generous empty transparent gutters. Feet share a horizontal baseline; human faces share a horizontal line. Occupy only middle 60% of image height.
The base geometry MUST match the captures: small round human head radius 15 units centred (0,-60), rounded rectangular torso 32 wide from y=-48 to -14, slim straight arms each 8 wide at x=-21 and x=13 from y=-44 to -22, small visible human hands, two short trouser legs y=-16 to0, tiny dark boots. Body height around 80 world units; head is about 36% of total height. Do NOT use giant chibi heads, squat blob bodies, enlarged eyes, animal faces, short plush limbs, full animal bodies, realistic anatomy or a 3D toy render. Eyes are two tiny dark dots offset right on the human face, no snouts or whiskers. All human skin light warm tan, same face size and leg length. Costumes sit OVER that SAME body and leave face, hands and legs visible. Headgear total height max 90 units from feet, width max 48; no silhouette enlargement except actual small accessories.
Style: clean flat filled rounded shapes, restrained soft highlight per piece, dark brown soft 2-unit outlines, no tiny surface detailing, no painted texture, no gloss. Match existing green woodland/tent/amber camping scene, felt/canvas/rubber/wood. Each character should be easy to redraw in Pixi Graphics.
Left to right EXACTLY:
1 CURRENT DEFAULT REFERENCE: short dark brown side-swept hair, warm ember orange simple camping top, charcoal trousers and dark boots, no hat or accessories. Faithfully match Minh in the lobby reference.
2 BOW CAT: warm oatmeal canvas hood with two SMALL triangular rounded cat ears, visible HUMAN face opening; berry pink/red simple bow on one ear; short rose camping jacket; tiny salmon fish-shaped crossbody bag with a single geometric tail. No white cartoon cat face, whiskers, yellow nose, gloves, pinafore or franchise identity.
3 ROBOT CAT: muted river-blue round canvas hood with two small rounded rectangular mechanical ear tabs, visible HUMAN face; brass yellow bell on a SHORT OFFSET tab, slate-blue camping jacket with an asymmetric rectangular front utility pocket, charcoal trousers. No white muzzle/belly, red collar or nose, whiskers, round white pocket, gadget, franchise identity.
4 CHUBBY FISH: chubby P U F F E R F I S H as a compact ochre felt HAT only, two small side fins and two simple round decorative eyes ON HAT above the visible human forehead; muted clay camping top, very small fin pocket. Human torso stays narrow; no spikes, threatening teeth, shark, fish body transformation or animal face.
5 CAMPING FROG: moss green rain hat with two round raised frog-eye bumps, human face visible; pine-green short raincoat with same base torso; dark green folded lotus-leaf backpack visible beside shoulder, not enormous. Minimal seams.
6 YELLOW DUCK: sand-yellow cap with a short soft orange beak visor and small green leaf resting on crown; ochre camping top; SMALL yellow inflatable duck swim ring around waist, thin enough to leave arms, trouser legs and identity unobstructed, one tiny duck-head nub to side, maximum 52 world units wide.
7 FOREST MUSHROOM: small low red/ember mushroom-cap hat with three broad irregular cream spots and cream underside, human face visible, bark-brown camping jacket, short sand scarf, compact wood-slat backpack peeking behind shoulder. Cap maximum 46 world units wide, not a giant canopy.
8 FROG GHOST: EXACTLY same frog costume geometry as character5, but pale desaturated blue spectral variant; same recognisable frog-eye hat and lotus backpack. Replace only legs with the existing short scalloped ghost tail. Gentle transparency alpha around78%, with faint outline, no scary monster.
Original costume designs only; no logos or recognisable copies of any existing characters, no wolves, no role cues. Keep palette muted but cheerful. Every look is equally available to every secret role.
Output must be delivered into /Users/long/repo/games/moonveil/.worktrees/art-themes/docs/visual/themes/ if file saving is available; no writes outside Moonveil.

## Correction (still rejected: face too wide)

Use case: identity-preserve
Asset type: corrected Moonveil costume concept contact sheet.
Input image 1 is the ACTUAL current camper screenshot crop and is the binding base silhouette reference. Input image2 is a REJECTED costume exploration: retain ONLY its clothing ideas and color choices, absolutely NOT its heads, hair volume, face proportions or chunky toy anatomy.
Make one clean wide transparent image, eight characters in a single horizontal row with generous transparent gutters and identical aligned feet.
CRITICAL CORRECTION: Every figure MUST have the exact body of image1: circular head ONLY 30 units wide; torso 32 units wide and34 tall; arms straight thin 8 units wide and22 tall; hands tiny circles; two separate straight short legs16 units long; head center60 units above feet; short flat hair hugging head, no big side swept hair. Total uncostumed height78 units, width42 units. The torso plus legs MUST be MUCH taller than the bare head. A head occupies only 30/78 of full height. In image2 heads are huge; REPLACE that anatomy entirely. Simple flat Pixi-style solid geometry and dark 2-unit thin soft outlines. No big ears on human face. Two tiny dots for eyes placed toward the right like image1. Human face visible in every costume. Keep torso straight, no plush/plump bodies.
Eight figures left to right:
0 literal current camper in image1: short tight dark hair, orange/ember rectangular top, charcoal straight trousers, dark boots, NO backpack.
1 same camper wearing an oatmeal SMALL cat-ear canvas hood, berry bow, rose top, tiny fish-shaped sling bag.
2 same camper wearing muted blue round canvas hood with SMALL rounded rectangular mechanical tabs, yellow bell on an offset short tab, blue jacket asymmetric rectangular utility pocket; no white belly, no red collar, no whiskers, no white cartoon face, no franchise character.
3 same camper wearing compact ochre pufferfish HAT with small side fins and two round decorative eyes, clay top and small fin-shaped pocket. Hat NOT a whole inflated body.
4 same camper wearing frog-eye rain hat, pine raincoat SAME 32x34 torso dimensions, compact folded lotus leaf backpack partly peeking out.
5 same camper wearing yellow duck beak cap, SINGLE FLAT LEAF on crown (NOT a sprout), sand top and THIN yellow duck swim ring max52 units wide around waist, keep human arms hands legs clear.
6 same camper wearing low red mushroom cap max46 units wide with3 broad irregular cream spots, short sand scarf, bark top, COMPACT wooden slat backpack partly peeking out.
7 same frog camper as4 but pale translucent blue ghost with scalloped short tail instead of legs; retain EXACT same hat and small leaf pack silhouette.
Headgear may go up to y=-90 but must never enlarge the HUMAN head opening. All props compact. No logos, no existing character likeness, no wolf-like shapes, no role symbolism. Stay flat, restrained Moonveil camping colors and materials. No added text, scenery, lighting, ring, shadow. Uniform geometry, equal gaps, complete figures no clipping.
