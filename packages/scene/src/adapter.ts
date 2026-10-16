// Shell-side adapter: SeatView + rules projection (public fields only) → SceneInput. PURE.
// Structural types only, so the scene package depends on neither @moonveil/protocol nor @moonveil/rules.
import type { Phase, SceneInput, SceneSeatState, SeatId } from './types.ts';
import { appearanceFromProtocol } from './appearance.ts';

export interface SeatViewLike {
  me: { seat: SeatId; kind: 'player' | 'moderator' };
  status: 'lobby' | 'playing' | 'ended';
  players: { seat: SeatId; name: string; appearance: { color: string; hat: string } | Record<string, string>; connected: boolean }[];
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

// Appearance: the protocol's provisional `{ color, hat }` is adapted; a full catalog object passes through.
function toAppearance(a: Record<string, string>, seat: SeatId) {
  if ('skin' in a && 'top' in a && 'hair' in a) return appearanceFromProtocol({ color: a.top ?? '', hat: a.hat ?? 'none' }, seat) && { skin: a.skin, top: a.top, hair: a.hair, hairColor: a.hairColor, hat: a.hat, extra: a.extra } as SceneInput['players'][number]['appearance'];
  return appearanceFromProtocol({ color: a.color ?? '', hat: a.hat ?? 'none' }, seat);
}

export function toSceneInput(view: SeatViewLike, game: ProjectionLike | null): SceneInput {
  const phase = phaseOf(view.status, game?.step.kind ?? null);
  const seats: SceneSeatState[] = game
    ? game.seatIds.map((seat, i) => ({ seat, alive: game.seats[i]?.alive ?? true, death: game.seats[i]?.death ?? null }))
    : [];
  const reveal = game?.reveal ? Object.fromEntries(game.seatIds.map((seat, i) => [seat, game.reveal!.roles[i] ?? ''])) : null;
  return {
    me: { seat: view.me.seat, kind: view.me.kind },
    players: view.players.map((p) => ({ seat: p.seat, name: p.name, appearance: toAppearance(p.appearance as Record<string, string>, p.seat), connected: p.connected })),
    phase,
    day: game?.day ?? 0,
    night: game?.night ?? 0,
    phaseEndsAt: view.phaseEndsAt,
    seats,
    reveal,
    voice: view.voice.map((g) => ({ channel: g.channel, listen: g.listen, speak: g.speak })),
  };
}
