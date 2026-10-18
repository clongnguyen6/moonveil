// Shell-side adapter: SeatView + rules projection (public fields only) → SceneInput. PURE.
// Structural types only, so the scene package depends on neither @moonveil/protocol nor @moonveil/rules.
import { HAIRS, HAIR_COLORS, HATS, SKINS, TOPS, type Phase, type SceneAppearance, type SceneInput, type SceneSeatState, type SeatId } from './types.ts';
import { appearanceFromProtocol, randomAppearance } from './appearance.ts';
import { COSTUMES } from './costumes/index.ts';
import type { Costume } from './rig.ts';

// Wire appearance (ADR 0011): canonical costume form { outfit, variant, color, hat, front, back, body? }, or legacy { color, hat }.
export interface WireAppearanceLike { outfit?: string; variant?: string; color?: string; hat?: string; front?: string; back?: string; body?: { skin: string; hair: string; hairColor: string } }

export interface SeatViewLike {
  me: { seat: SeatId; kind: 'player' | 'moderator' };
  status: 'lobby' | 'playing' | 'ended';
  players: { seat: SeatId; name: string; appearance: WireAppearanceLike; connected: boolean }[];
  phaseEndsAt: number | null;
  voice: { channel: string; listen: boolean; speak: boolean }[];
}
// Subset of the rules Projection / HostView the scene needs. Everything here is public to every viewer.
export interface ProjectionLike {
  night: number;
  day: number;
  step: { kind: string };
  seats: { alive: boolean; death: { cause: string; night: number; day: number } | null }[];
  seatIds: SeatId[];
  reveal: { roles: string[] } | null;
}

export function phaseOf(status: SeatViewLike['status'], stepKind: string | null): Phase {
  if (status === 'lobby') return 'lobby';
  if (status === 'ended' || stepKind === 'ended') return 'ended';
  if (stepKind && stepKind.startsWith('night')) return 'night';
  return 'day';   // day.*, hunter (resolved at the fire), unknown
}

const has = <T extends string>(list: readonly T[], v: string | undefined): v is T => v !== undefined && (list as readonly string[]).includes(v);
const pick = (list: readonly string[], v: string | undefined) => (has(list, v) ? v : list[0]!);

// A wire outfit the scene dresses: a registered costume that declares its catalog options (test: options = wire row).
// Anything else (placeholder, unknown ids, prototype keys) is not reachable from the wire.
function wireCostume(id: string): Costume | null {
  const c = Object.hasOwn(COSTUMES, id) ? COSTUMES[id]! : null;
  return c?.options ? c : null;
}

// Wire appearance -> scene appearance, for snapshots and local look drafts. Only catalog ids reach the art: choices
// outside the outfit's options fall back to its defaults; an outfit the scene can't draw renders as a plain camper.
export function sceneAppearance(a: WireAppearanceLike, seat: SeatId): SceneAppearance {
  if (a.outfit === undefined) return appearanceFromProtocol({ color: a.color ?? '', hat: a.hat ?? 'none' }, seat);
  const seeded = randomAppearance(seat);
  const b = a.body && has(SKINS, a.body.skin) && has(HAIRS, a.body.hair) && has(HAIR_COLORS, a.body.hairColor) ? a.body : seeded;
  const body = { skin: b.skin, hair: b.hair, hairColor: b.hairColor } as Pick<SceneAppearance, 'skin' | 'hair' | 'hairColor'>;
  const costume = wireCostume(a.outfit);
  if (!costume) {
    const camper = a.outfit === 'camper';
    return {
      ...body, extra: 'none', top: has(TOPS, a.color) ? a.color : seeded.top,
      hat: camper && has(HATS, a.hat) ? a.hat : 'none',
      front: camper && a.front === 'scarf' ? 'scarf' : 'none',
      back: camper && a.back === 'backpack' ? 'backpack' : 'none',
    };
  }
  const o = costume.options!;
  const top = pick(o.colors ?? TOPS, a.color) as SceneAppearance['top'];
  return { ...body, extra: 'none', top, outfit: costume.id, variant: pick(o.variants, a.variant), hat: pick(o.hats, a.hat), front: pick(o.fronts, a.front), back: pick(o.backs, a.back) };
}

export function toSceneInput(view: SeatViewLike, game: ProjectionLike | null): SceneInput {
  const phase = phaseOf(view.status, game?.step.kind ?? null);
  const seats: SceneSeatState[] = game
    ? game.seatIds.map((seat, i) => ({ seat, alive: game.seats[i]?.alive ?? true, death: game.seats[i]?.death ?? null }))
    : [];
  const reveal = game?.reveal ? Object.fromEntries(game.seatIds.map((seat, i) => [seat, game.reveal!.roles[i] ?? ''])) : null;
  return {
    me: { seat: view.me.seat, kind: view.me.kind },
    players: view.players.map((p) => ({ seat: p.seat, name: p.name, appearance: sceneAppearance(p.appearance, p.seat), connected: p.connected })),
    phase,
    day: game?.day ?? 0,
    night: game?.night ?? 0,
    phaseEndsAt: view.phaseEndsAt,
    seats,
    reveal,
    voice: view.voice.map((g) => ({ channel: g.channel, listen: g.listen, speak: g.speak })),
  };
}
