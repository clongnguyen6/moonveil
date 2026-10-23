# Dawn and death presentation (visual-dawn)

Scene dev page, fixtures only (no server, no voice, no live room), 8 players. Playwright **Chromium emulation**, headless,
software WebGL, shared machine under load 12-23 (`runs.txt`); not real devices. "before" = live 7011b14, "after" = this
branch. `packages/scene/scripts/dawn-check.mjs` drives every scenario on the **scene clock** and asserts per-seat state
(`debugSeats()`); old builds have no hook: captures only. Times in file names = scene seconds after dawn (or after the death).

| scenario | files | what it shows |
|---|---|---|
| night death, living view | `*/night-death-living-{laptop,phone}-high-t3.35/t9` | before: victim's tent lantern stays lit by day. after: at the moment its tent would open, the lantern gutters out and a wisp rises; nobody is drawn; others seat by ~8.6 s |
| night death, victim's view | `*/night-death-victim-laptop-high-t2/t3.6/t9`, `compare/night-victim-own-view…` | before: a ghost by the fire at once while all others are still in their tents. after: still in the tent at 2 s, ghost at its tent door at 3.6 s |
| Hunter shot at dawn (death at +1.1 s, before the targets' tents open) | `*/race-{s1,s4,moderator}-laptop-high-t9`, `compare/race-victim-view…` | before (victim / ghost / moderator view): the dead seats drawn as living campers (An seated, Bảo standing). after: never alive; living view: absent; victim and moderator: ghosts |
| day death (execution) | `*/day-death-living-{laptop,phone}-high-t0.3/t1.5` | before: gone in one frame. after: fading at the seat with a wisp at 0.3 s, absent at 1.5 s |
| low / reduced motion | `*/night-death-living-laptop-{low,reduced-motion}-*`, `*/day-death-living-laptop-low-*` | after: lantern straight out, no wisp (low) / one static wisp (reduced motion), same choreography |
| Halloween theme | `after/night-death-living-laptop-high-halloween-*` | same beat with the overlay on |

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
- **Not shown here**: the real server flow (Hunter step, real poses) and the UI overlay together with the scene (UI owner's
  combined set); reload during dawn is unit-tested (snap), not captured.
- **Perceptual, untested**: whether the tent beat is noticed at a glance on a phone, whether the 2.5-8 s dawn pacing
  matches the UI announcement, whether players read the wisp as "this seat died" (no role or cause shown, by design).
