// Pure helpers for reconciling SceneInput snapshots with live avatars.
import { HATS, type SceneAppearance, type ScenePlayer, type SeatId } from './types.ts';
import { TOP_COLORS } from './appearance.ts';
import { DEFAULT_CHOICE, type Costume, type CostumeChoice } from './rig.ts';
import { FIRE, isWalkable, type MapLayout, type Pt } from './map.ts';
import type { AvatarMode } from './avatar.ts';

// Outfit id (costume module) for an appearance; '' = base camper look.
export function outfitOf(a: SceneAppearance): string {
  const o = a.outfit ?? '';
  return o === 'camper' ? '' : o;
}

// The player's choices as the costume pieces see them. Legacy `extra` maps onto front/back when those are absent.
export function choiceFor(a: SceneAppearance): CostumeChoice {
  return {
    variant: a.variant ?? DEFAULT_CHOICE.variant,
    color: TOP_COLORS[a.top] ?? DEFAULT_CHOICE.color,
    hat: a.hat,
    front: a.front ?? (a.extra === 'scarf' ? 'scarf' : 'none'),
    back: a.back ?? (a.extra === 'backpack' ? 'backpack' : 'none'),
  };
}

// Which items the base rig draws. Base hat, scarf and backpack belong to the camper look (no costume);
// an outfit costume draws every chosen item itself, so nothing is drawn twice.
export interface BaseItems { hair: boolean; hat: boolean; scarf: boolean; backpack: boolean }
export function baseItems(a: SceneAppearance, costume: Costume | null): BaseItems {
  const camper = !costume, choice = choiceFor(a);
  return {
    hair: !costume?.hidesHair,
    hat: camper && (HATS as readonly string[]).includes(a.hat),
    scarf: camper && choice.front === 'scarf',
    backpack: camper && choice.back === 'backpack',
  };
}

export function appearanceKey(a: SceneAppearance): string {
  return `${a.skin}|${a.top}|${a.hair}|${a.hairColor}|${a.hat}|${a.extra}|${outfitOf(a)}|${a.variant ?? ''}|${a.front ?? ''}|${a.back ?? ''}`;
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

// Appearance a seat should render: the local-only draft override for the local seat while one is set,
// otherwise the snapshot's appearance. Never applies to other seats.
export function effectiveAppearance(input: { me: { seat: SeatId }; players: readonly ScenePlayer[] }, seat: SeatId, override: SceneAppearance | null): SceneAppearance | null {
  const p = input.players.find((x) => x.seat === seat);
  if (!p) return null;
  return seat === input.me.seat && override ? override : p.appearance;
}

// Tracks the rendered look of one avatar: apply() reports whether a re-bake is needed.
export class LookTracker {
  current: SceneAppearance;
  private key: string;
  rebakes = 0;
  constructor(a: SceneAppearance) { this.current = a; this.key = appearanceKey(a); }
  apply(a: SceneAppearance): boolean {
    const k = appearanceKey(a);
    if (k === this.key) return false;
    this.key = k; this.current = a; this.rebakes++;
    return true;
  }
}
