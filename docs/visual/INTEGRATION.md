# Scene integration plan (proposal, visual scope)

How the camp renderer will be driven by real game state from `apps/web` and the protocol in `dev` (foundation b3d9ece…3225999) and the rules projection (`rules` branch, `packages/rules/src/projection.ts`). Foundation code is not edited here; the interface below is what visual asks foundation to add. Status: principle accepted by Human (2026-10-16); living seats get no pose stream during play; moderator sees everything until the Q25 decision.

## Principle

The renderer is a pure function of three inputs: the seat's `SeatView` snapshot, a server-filtered pose stream, and local input. The scene never holds data the seat may not see, so there is no client-side secret filter to get wrong. "Ghost view" is not a mode the client switches on; it is what the server sends to a seat whose channel grants include `ghosts`. A living client simply never receives ghost poses, ghost speaking state, or ghost positions.

## Where code lives

- `packages/scene` (visual): PixiJS scene (the former `preview/` renderer, now extracted). Exports `mountScene(host, opts): SceneHandle` with `setInput(SceneInput)`, `setPoses(PoseFrame)`, `setSpeaking(SeatId[])`, `on('move' | 'emote', cb)`, `setSafeArea()`, `destroy()`; `@moonveil/scene/map` is the DOM-free layout + `isWalkable` for the server; `@moonveil/scene/fixtures` is the stub server used by the dev harness and tests. No sockets, no React, no protocol imports.
- `apps/web` (foundation): mounts the scene inside `Room` when `view` exists, maps `SeatView` to `SceneInput` (`toSceneInput`, type published by the scene package), forwards `move` events to the client, and keeps all HUD and game panels (ready, vote, night actions, moderator controls) in React over the canvas.
- Rules (`packages/rules`): unchanged. The shell reads only public fields of `Projection`.

## SceneInput (derived in the shell from SeatView; public fields only)

| Field | Source | Notes |
|---|---|---|
| `me: { seat, kind }` | `view.me` | moderator renders the same scene with the moderator's grants |
| `players: { seat, name, appearance, connected }[]` | `view.players` | seat order = campfire seat and tent index (stable for the match) |
| `phase: 'lobby' \| 'day' \| 'night' \| 'ended'`, `day`, `night` | `view.status` + `(view.game as Projection).step.kind` | `night.*` and `hunter` during night → `night`; `day.*` → `day` |
| `phaseEndsAt` | `view.phaseEndsAt` | HUD timer only; the scene does not depend on it |
| `seats: { seat, alive, death }[]` | `Projection.seats` | public per the rules projection; `!alive` is drawn as an empty seat for everyone |
| `reveal` | `Projection.reveal` | end-of-match role reveal, all viewers |
| `voice: VoiceGrant[]` | `view.voice` | which channel the mic button and speaking indicators refer to |

Never in SceneInput: `Projection.me.role`, `facts`, `pack`, `actions`, `moderator`. The shell's mapping function is the only place that touches `view.game`, and it copies listed fields rather than spreading.

Scene state that is not in the snapshot is **positional**: the scene computes seat and tent positions from seat index, so living players during a match need no pose data at all. Only free movement needs the stream below: lobby (everyone) and ghosts (during play).

## Pose stream (new; foundation protocol + server)

- Client → server: `{ t: 'move', x, y, facing, moving }` at ≤ 10 Hz, sent only when the shell says movement is allowed (lobby, or `seats[me].alive === false` during play). The server validates bounds and rate and silently drops moves from seats that may not move (living seat during play; any seat while `status === 'ended'`). No ack.
- Server → client: `{ t: 'poses', poses: [{ seat, x, y, facing, moving }] }` at ≤ 10 Hz, batched per room tick. The recipient set is derived server-side:
  - lobby: all players' poses to all seats;
  - playing: a seat receives poses of seats that are `!alive` only if its own `engine.channels(state, seat)` grant includes `{ channel: 'ghosts', listen: true }`; living seats receive no pose frames at all; the moderator receives all;
  - night steps: identical rule (ghosts keep moving); living seats never receive frames.
  So pose visibility reuses the already-approved channel policy instead of a second ghost rule. A pending-shot Hunter (public-listen only) therefore sees no ghosts, consistent with `channels.ts` F1.
- Pose frames carry no counters shared across seats (same reasoning as `seq` in ADR 0001). Client interpolates between frames; missing frames freeze the avatar in place and after 3 s fade it to idle at its last position.
- Reconnect: the scene snaps to the snapshot with no transition animation, then resumes poses.

## Speaking indicators (new; foundation + voice)

ADR 0001 item 7 already requires the provider to re-publish speaking per seat through the server. Proposed frame: `{ t: 'speaking', seats: SeatId[] }` at ≤ 5 Hz, filtered per viewer to seats on channels the viewer may `listen` to. Ghost speakers thus reach ghosts and the moderator only; wolves at night reach wolves only. The scene shows the indicator for any seat in the list; it does not know the channel.

## Appearance catalog (protocol change, foundation; ids from visual)

`Appearance` is provisional `{ color, hat }`. Visual will deliver the final id lists with the art pass; proposed shape: `{ skin, top, hair, hairColor, hat, extra }`, all enums, chosen by the player, never touched by the server or engine. Role independence holds by construction: appearance is set before roles exist and is in `PublicSeat` for everyone.

## Phase transitions and timing

- The scene plays the night transition (~7 s) and dawn client-side on `phase` change. It is cosmetic: the night-action panel opens when the step changes, not when the walk finishes, so the animation can never delay or reveal timing. If a night step can be shorter than the transition, the scene shortens the walk.
- Nothing in the scene depends on when other seats act; it only reacts to its own snapshot and to poses it was entitled to receive.

## Isolation checks (e2e, foundation harness)

The harness already captures every WS frame per context. Add assertions: during play a living seat receives zero `poses` and zero `speaking` entries for dead seats; a ghost seat receives poses only for `!alive` seats; the moderator receives all; after `ended`, no `poses`. Night: living seats receive no `poses` frames.

## What visual needs from foundation (decision list)

1. A mount seam in `apps/web` `Room`: canvas host element and a `toSceneInput(view)` mapping owned by the shell, using `SceneInput` from `packages/scene`.
2. Protocol + server: `move`, `poses`, `speaking` frames with the recipient rules above, derived from `engine.channels` and `Projection.seats[].alive`; rate limits; bounds check against a map descriptor the scene package exports (`WALKABLE` bounds + a server-side `isWalkable(x, y)` function, pure, no DOM).
3. `SeatView.game` typed as the rules `Projection` once `packages/rules` is in the workspace, so the shell mapping is type-checked rather than cast.
4. The `Appearance` schema swap when visual delivers the catalog.
5. Workspace wiring for `packages/scene` (visual owns its contents; foundation owns root config).

Open: whether the moderator should see ghosts by default (`moderatorHearsAll` already gates ghost audio; proposal: same flag gates ghost poses).
