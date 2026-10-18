// Pure helpers for reconciling SceneInput snapshots with live avatars.
import type { SceneAppearance, ScenePlayer, SeatId } from './types.ts';
import { FIRE, isWalkable, type MapLayout, type Pt } from './map.ts';
import type { AvatarMode } from './avatar.ts';

export function appearanceKey(a: SceneAppearance): string {
  return `${a.skin}|${a.top}|${a.hair}|${a.hairColor}|${a.hat}|${a.extra}`;
}

export interface PlayersDiff { added: SeatId[]; removed: SeatId[]; changedAppearance: SeatId[]; renamed: SeatId[] }

// Which seats need an avatar created, destroyed, re-baked or relabelled between two snapshots.
export function playersDiff(prev: readonly ScenePlayer[], next: readonly ScenePlayer[]): PlayersDiff {
  const before = new Map(prev.map((p) => [p.seat, p]));
  const after = new Map(next.map((p) => [p.seat, p]));
  const d: PlayersDiff = { added: [], removed: [], changedAppearance: [], renamed: [] };
  for (const p of next) {
    const b = before.get(p.seat);
    if (!b) { d.added.push(p.seat); continue; }
    if (appearanceKey(b.appearance) !== appearanceKey(p.appearance)) d.changedAppearance.push(p.seat);
    if (b.name !== p.name) d.renamed.push(p.seat);
  }
  for (const p of prev) if (!after.has(p.seat)) d.removed.push(p.seat);
  return d;
}

// Lobby spawn: the local player's first position. Spread by player index so two players who join at the
// same moment never stand on exactly the same spot (their labels would stack). Walkable by construction.
export function spawnPoint(map: MapLayout, index: number): Pt {
  const base = { x: FIRE.x - 40, y: FIRE.y + 200 };
  // ordered candidates: the base, then rings of six around it; the index-th walkable one is the spawn
  const walkable: Pt[] = [];
  for (let i = 0; i < 60 && walkable.length <= index; i++) {
    const ring = Math.ceil(i / 6), a = ((i - 1) % 6) * (Math.PI / 3) + ring * 0.5;
    const p = i === 0 ? base : { x: base.x + Math.cos(a) * 70 * ring, y: base.y + Math.sin(a) * 42 * ring };
    if (isWalkable(map, p.x, p.y)) walkable.push(p);
  }
  return walkable[index] ?? walkable[walkable.length - 1] ?? base;
}

// Nothing of a hidden avatar may render: body, shadow, ring, label, emote, aura.
export function avatarVisible(mode: AvatarMode, alpha: number): boolean {
  return mode !== 'hidden' && alpha > 0.01;
}
