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

## Resize and safe areas

- The canvas fills the slot (`position:absolute; inset:0` as in layout.css). The scene observes the slot with `ResizeObserver` and resizes itself; `scene.resize()` exists for shells that prefer to drive it.
- `setSafeArea({ top, right, bottom, left })` in CSS px: the camera frames the camp inside the uncovered area. Pass the topbar height (and the dock height when it overlaps the slot on phones). The scene's HUD elements are only the joystick.
- Portrait phones use the "tight" camera (zoomed, soft follow of your avatar) unless `camera: 'fit'` is passed; this is decided from the slot's size, not the window.

## Timing and choreography

Phase changes animate inside the scene (walk to seats, night walk to tents ~7 s, dawn). They are cosmetic: the shell opens its panels on the step change immediately. First `setInput` after mount, and any input after a reconnect, snaps without animation.

## Decisions requested from the UI owner

1. Where the `poses` and `speaking` frames surface in the session (today `client.ts` drops unknown frames); the scene needs a callback for `poses`.
2. Topbar height source for `setSafeArea` (fixed token vs measured).
3. Whether taps on avatars should open the seat card (visual's suggestion) or be ignored in v1.
4. Ambience toggle placement (Settings) and the default (off until a gesture, then user preference).
