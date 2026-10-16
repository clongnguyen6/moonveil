# Pose model: units and bounds (proposal to foundation)

Status: proposal from visual, 2026-10-16. Foundation owns the protocol and server; nothing here edits them.

## Today (foundation-3)

- `move { x, y ∈ [0, 1], facing: number ∈ [-4, 4], moving }` at ≤ 12/s; `poses { poses: Pose[] }` at 10 Hz; recipients by the ghosts-channel rule (same rule as the scene's fixture server, verified by its tests).
- Coordinates are "normalized map coords (PROVISIONAL until packages/scene exports walkable bounds)". The server does not check walkability.

## Proposal: adopt world units from `@moonveil/scene/map`

| Item | Value | Source |
|---|---|---|
| Units | world units, integers on the wire | `WORLD = { w: 1700, h: 1400 }` |
| Bounds for living movement | `WALK_BOUNDS = { minX: 40, maxX: 1660, minY: 120, maxY: 1370 }` | `WALK_BOUNDS` |
| Bounds for ghosts | world rect inflated by 200 | `inWorld(x, y)` |
| Walkability (lobby) | `isWalkable(map, x, y)`: bounds, stream except on the bridge, tents, fire pit, lantern posts, bushes, trees | `createMap(playerCount)`, `isWalkable` |
| Map instance | `createMap(playerCount, seed = 2026)` per room, pure, ~1 ms; identical in the renderer and the server | `createMap` |
| Facing | `1 \| -1` | scene `Pose.facing` |
| Moving | boolean | unchanged |

Why world units: one coordinate system for the server, the renderer, the fixtures and the tests; integer wire values (no float drift, smaller frames); walkability and seat/tent positions are defined in these units, so the server can validate without conversion.

Server-side validation proposed (all in the pure module, no DOM):
1. Lobby: drop the move unless `isWalkable(map, x, y)`. Optional cheap plausibility: distance from the seat's last accepted pose ≤ 190 u/s × elapsed + slack (the scene's walk speed is 190 u/s, ghosts 150).
2. Play, ghost: drop unless `inWorld(x, y)`.
3. `facing` must be `1` or `-1`; `moving` boolean. Zod: `x: z.number().int().min(-200).max(1900)`, `y: z.number().int().min(-200).max(1600)`, `facing: z.union([z.literal(1), z.literal(-1)])`.
4. Map size depends on the player count (tent rows above 10). Create the map when the room starts (count fixed) and in the lobby recreate it when the count changes; the renderer does the same.

What changes for clients: nothing structural. The scene already emits `move` in world units via `on('move')`. Until the switch, the shell converts with `toWireMove(pose, 'normalized')` and `fromWirePoses(frame.poses, 'normalized')` from `@moonveil/scene`; after the switch it passes `'world'` (or drops the converters).

## Rate and cadence (already aligned)

Scene emits ≤ 10 moves/s and only when the pose changed; server accepts 12/s and flushes poses at 10 Hz; the renderer interpolates with a 120 ms delay and hides a ghost after 3 s without a pose.

## Open

- Whether the moderator receives poses during the lobby only or always (today: `seesPoses` = lobby or ghost-listen; moderator has ghost-listen when `moderatorHearsAll`). The scene renders whatever arrives.
- Seat positions are not poses: living players during play are drawn at `createMap(n).seats[index]` by player order; the server need not send them.
