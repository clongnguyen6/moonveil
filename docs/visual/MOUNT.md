# Mount seam: `packages/scene` in the web shell (proposal to the UI owner, via Lead)

Status: proposal from visual, 2026-10-16. Targets the UI owner's existing `.scene-host > .scene-slot` in `apps/web/src/ui/GameApp.tsx` (branch game-ui). Visual does not edit `apps/web`.

## What the shell passes in

```ts
import { mountScene, toSceneInput, toWireMove, fromWirePoses } from '@moonveil/scene';

// once, when .scene-slot exists (useEffect with [] deps; StrictMode double-mount is safe: destroy() before ready is handled)
const scene = mountScene(slotEl, { input: toSceneInput(view, gameView) });
scene.setSafeArea({ top: topbarEl.offsetHeight });        // CSS px the HUD covers; camera frames the rest
scene.setAudio(settings.ambience);                          // procedural ambience; must follow a user gesture

// on every session change
scene.setInput(toSceneInput(view, gameView));               // SeatView + HostView (public fields only; see adapter.ts)
scene.setSpeaking(session.speaking);                        // SeatId[] the server says are speaking on channels I may hear
scene.setSpeakingLocal(mic.on);                             // immediate local feedback for my own mic

// on server frames
scene.setPoses(fromWirePoses(msg.poses, 'normalized'));     // { t: 'poses' } frames; 'world' after POSES.md is adopted

// on unmount
scene.destroy();
```

`toSceneInput` takes structural types (`SeatViewLike`, `ProjectionLike`): `view` from the session and `gameView(view)` (rules `HostView`). It copies only public fields: players, alive flags, public death records, step kind → phase, reveal at the end. No role, facts, pack or actions ever enter the scene.

## What comes back

| Event | Payload | Shell action |
|---|---|---|
| `on('move')` | `Pose { seat, x, y, facing, moving }` in world units, ≤ 10/s, only when changed, only when the seat may move (lobby, or dead during play) | `session.send({ t: 'move', ...toWireMove(pose, 'normalized') })` |
| `on('tap')` | `{ x, y, seat }`: world position and the avatar hit, if any (within ~48 units) | `seat` → open that player's card / vote target; empty ground → nothing (the scene already walks there when allowed) |
| `on('emote')` | `string` | forward as an emote message when the protocol has one (none today) |

Keyboard (WASD/arrows, Space = push-to-talk callback via `setSpeakingLocal` is the shell's choice; the scene only reports) and the floating touch joystick live inside the scene; the joystick appears on touch devices and attaches to the slot element. Buttons over the slot must set `data-ui` on their container so taps on them do not reach the joystick.

## Cost modes (for tests and low-end devices)

`mountScene(slot, { input, quality })` with `quality: 'off' | 'low' | 'high' | 'auto'` (default `auto`). `off` mounts no canvas and runs no loop; harnesses can force it without touching the shell by setting `globalThis.__MOONVEIL_SCENE = 'off'` (or `'low'`) in a page init script, which `auto` honours. `auto` also picks `low` under `navigator.webdriver` and on ≤ 4 cores / ≤ 4 GB. The loop stops while the document is hidden; `prefers-reduced-motion` caps it at 4 fps. The Settings "scene" switch stays the user-facing off.

## Appearance editor preview (local-only draft)

While the player edits their look, call `scene.setLocalAppearanceOverride(draft)` on every colour or hat change (a full `SceneAppearance`: pass the draft wire appearance through `sceneAppearance(draft, mySeat)`, which handles costume and legacy forms). The local avatar re-renders the draft in place: position, pose, facing, animation and intent are preserved, nothing is sent, and other seats keep rendering the snapshot. Snapshot updates arriving during the draft (anyone's `setInput`) do not clear it. On Save, send the profile to the server as today and call `setLocalAppearanceOverride(null)` once the saved snapshot arrives (or immediately; the next snapshot re-renders the saved look either way). On Cancel, call `setLocalAppearanceOverride(null)`: the snapshot look returns.

Test hook, gated: with `mountScene(slot, { debug: true })`, `scene.debugAppearance(seatId)` returns the appearance that avatar currently renders (`null` for unknown seats or when `debug` is off). Not a production surface; the harness enables it.

## Theme (player opt-in, local only)

- `mountScene(slot, { theme: 'normal' | 'halloween' })`, default `'normal'`. Change at runtime without remounting:
  `await scene.setTheme('halloween' | 'normal')` (later calls win; resolves once shown, or if the overlay failed to
  load, in which case the scene stays normal and a warning is logged).
- The shell owns the choice (Settings "Theme", persisted locally). Never from the wire: `SceneInput` has no theme, the
  server cannot set it, and it is never forced room-wide or activated by date.
- `'halloween'` is a separate lazy chunk (`themes/halloween.ts`, dynamic import on first selection). Default users neither
  download nor execute it; the default bundle carries only the tiny switch (`themes/index.ts`).
- `'normal'` removes every decoration, glow, light and the plum night. Toggling back re-attaches without reloading.
- Unchanged guarantees: static on `low` and reduced motion; labels above every decoration; seats, speaking rings and the
  seated ring kept clear for 4-16 players (`test/halloween.test.ts`). Evidence: `docs/visual/halloween-scene/`.

## Resize and safe areas

- The canvas fills the slot (`position:absolute; inset:0` as in layout.css). The scene observes the slot with `ResizeObserver` and resizes itself; `scene.resize()` exists for shells that prefer to drive it.
- `setSafeArea({ top, right, bottom, left })` in CSS px: the camera frames the camp inside the uncovered area. Pass the topbar height (and the dock height when it overlaps the slot on phones). The scene's HUD elements are only the joystick.
- Camera framing (`src/framing.ts`): the whole camp, except on small slots during play (camp fit below 0.45 = phones; laptops unchanged), where the seat ring (day/ended) or tents + fire (night) is framed up to scale 0.65 and names stay 12 px; the lobby is never focus-framed; a moving local ghost stays in frame. Contract for overlays: with no bottom safe area, seats never enter the bottom 26 % of the uncovered height (camp frame: 25.7 %), so a bottom row smaller than that needs no safe area. Evidence: `docs/visual/framing/`.
- Portrait phones use the "tight" camera (zoomed, soft follow of your avatar) unless `camera: 'fit'` is passed; this is decided from the slot's size, not the window.

## Timing and choreography

Phase changes animate inside the scene (walk to seats, night walk to tents ~7 s, dawn). They are cosmetic: the shell opens its panels on the step change immediately. First `setInput` after mount, and any input after a reconnect, snaps without animation.

## Decisions requested from the UI owner

1. Where the `poses` and `speaking` frames surface in the session (today `client.ts` drops unknown frames); the scene needs a callback for `poses`.
2. Topbar height source for `setSafeArea` (fixed token vs measured).
3. Whether taps on avatars should open the seat card (visual's suggestion) or be ignored in v1.
4. Ambience toggle placement (Settings) and the default (off until a gesture, then user preference).
