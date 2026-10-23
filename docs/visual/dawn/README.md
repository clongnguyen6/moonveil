# Dawn and death presentation (visual-dawn)

Scene dev page, fixtures only (no server, no voice, no live room), 8 players. Playwright **Chromium emulation**, headless,
software WebGL, shared machine under load 12-23 (`runs.txt`); not real devices. "before" = live 7011b14, "after" = this
branch at ab7a683 (memorials included). `packages/scene/scripts/dawn-check.mjs` drives every scenario on the **scene clock** and asserts per-seat state
(`debugSeats()`); old builds have no hook: captures only. Times in file names = scene seconds after dawn (or after the death).

| scenario | files | what it shows |
|---|---|---|
| night death, living view | `*/night-death-living-{laptop,phone}-high-t3.35/t9` | before: victim's tent lantern stays lit by day. after: at the moment its tent would open, the lantern gutters out and a wisp rises; nobody is drawn; others seat by ~8.6 s |
| night death, victim's view | `*/night-death-victim-laptop-high-t2/t3.6/t9`, `compare/night-victim-own-view…` | before: a ghost by the fire at once while all others are still in their tents. after: still in the tent at 2 s, ghost at its tent door at 3.6 s |
| Hunter shot at dawn (death at +1.1 s, before the targets' tents open) | `*/race-{s1,s4,moderator}-laptop-high-t9`, `compare/race-victim-view…` | before (victim / ghost / moderator view): the dead seats drawn as living campers (An seated, Bảo standing). after: never alive; living view: absent; victim and moderator: ghosts |
| day death (execution) | `*/day-death-living-{laptop,phone}-high-t0.3/t1.5` | before: gone in one frame. after: fading at the seat with a wisp at 0.3 s, absent at 1.5 s |
| low / reduced motion | `*/night-death-living-laptop-{low,reduced-motion}-*`, `*/day-death-living-laptop-low-*` | after: lantern straight out, no wisp (low) / one static wisp (reduced motion), same choreography |
| Halloween theme | `after/night-death-living-laptop-high-halloween-*` | same beat with the overlay on |
| memorials, 3 dead seats (s2, s5, s7 at dawn), day then the next night | `*/memorials-{laptop,phone}[-halloween]-t10/t19`, `compare/memorial-stone-laptop-zoom` | before: empty seats. after: a small headstone behind each dead seat's stump with the display name (muted italic), kept through the night; Halloween: tiny pumpkin instead of the flower |

## Limits

- **Proven by unit tests** (`test/staging.test.ts`, scene clock, fake avatars + the scene's per-frame rules): the race
  in living / victim / moderator views (never drawn alive, nothing pending), the race just after coming out, night victim
  (beat time and place, lantern out, never drawn for the living), victim's own view (in the tent until its time, ghost at
  the door), day death (fade, wisp, then hidden / ghost), snap during dawn (consistent, nothing pending), low/reduced
  (lantern straight out), reduced-motion clock (same real time at 4 fps as 60 fps). Negative controls: removing the
  per-seat cancel fails both race tests; the old 0.1 s step clamp fails the clock test.
- **Proven by captures + assertions** (`after/dawn-check.json`, all OK): the same in the real scene for those views, phone
  and laptop, high, low, reduced motion, Halloween. Clock in the browser (reduced motion): 9 s of scene time took 23.7 s
  real before vs 9.3 s after. Under heavy load `high` itself runs slower than real time (software WebGL below 10 fps hits
  the stall clamp): a test-machine effect, not a product timing claim.
- **Memorials, unit tests** (`test/memorial.test.ts`): public dead only (not disconnected, not removed: no memorial and
  no wisp for `death.cause === 'removed'`), night victim only from its tent beat, day death only after its fade, Hunter at
  dawn + shot target (both, nothing pending), reload places all at once, lobby / next match clear them, one name per
  player (hidden while that ghost is visible within 130 units), the stone never covers a camper behind it and never
  touches a pumpkin (4-16 players), full raise up to 10 players. Negative controls: showing a night victim's memorial at
  once, or treating removal as death, each fail their test.
- **Memorials, captures + assertions**: memorial set over time and names shown in every after scenario, 3 dead seats
  through day and night on phone and laptop, Normal and Halloween.
- **Not shown here**: the real server flow (Hunter step, real poses) and the UI overlay together with the scene (UI owner's
  combined set); reload during dawn is unit-tested (snap), not captured.
- **Perceptual, untested**: whether the small stone reads as a memorial at phone scale (the name carries identity; in
  11-16 player rings some side stones stand lower behind their stump), whether the tent beat is noticed at a glance on a phone, whether the 2.5-8 s dawn pacing
  matches the UI announcement, whether players read the wisp as "this seat died" (no role or cause shown, by design).

## Memorial layout fix (visual-memorial-fix)

Prompted by the UI owner's combined captures (game-ui-dawn 407f06d): a memorial name stacked on a camper label and a
stone half-hidden behind the camper in front at phone size. Now stones stand at the nearest clear spot by their seat
(never touching another seat's camper, in front or behind, a pumpkin or another stone), camper labels keep off stones,
and memorial names are placed around their stone clear of camper labels, campers, stones and other names (leader line
when moved; hidden rather than overlapping when nothing is clear).

- `layout/layout-{slot375x253,slot390x428,laptop}[-halloween]-{survivor,ghost}-t10.jpg`: 3 dead seats at the UI's
  scene-slot sizes (top bar 56 px; 375x667 also the chat row 64 px), dev page, Chromium emulation. `layout/dawn-check.json`:
  every run asserts with the real screen boxes from `debugSeats()` that no memorial name or stone overlaps a camper label,
  a camper (head box), a stone or another name: all OK, 3/3 names placed in every run. Memorial and race after-frames
  refreshed with the new stone spots.
- Unit tests (`test/memorial.test.ts`, node mirror of the label pass in `test/helpers/label-sim.ts`, 4-16 players, four
  death sets): zero overlaps and every name shown at 390x844, laptop and the whole-camp ghost view; negative control
  (names placed without obstacles) is caught.
- **Limits at 375x667 with the chat row (133 px of camp):** (1) with heavy death sets a few memorial names are hidden
  rather than overlapping (5 of 54 with every third seat dead, 8 of 84 with all but two dead; none with 1-2 deaths);
  (2) **pre-existing, not from this bundle:** the camper-label resolver already leaves 19 camper-label overlaps there
  with no deaths at all (rooms of 10+); there, two camper labels can touch a stone. Known limit for the owner.
- Not shown: the real UI (top bar, chat row, panels) with these memorials; the UI owner's exact assertion on the merged SHA.
