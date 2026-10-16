// Pure selectors over SeatView + rules projection. No caching, no inference beyond what the view states.
import type { PublicSeat, SeatView, VoiceGrant } from '@moonveil/protocol';
import type { AvailableAction, Role, Seat } from '@moonveil/rules';
import type { GameView } from './types.ts';

export function projection(view: SeatView | null): GameView | null {
  const g = view?.game as GameView | null | undefined;
  return g && typeof g === 'object' && 'step' in g && 'seatIds' in g ? g : null;
}

/** Player record for engine seat index i. */
export function playerAt(view: SeatView, g: GameView, i: Seat): PublicSeat | undefined {
  const id = g.seatIds[i];
  return id === undefined ? undefined : view.players.find((p) => p.seat === id);
}

export function nameAt(view: SeatView, g: GameView, i: Seat | null | undefined): string {
  if (i === null || i === undefined) return '';
  return playerAt(view, g, i)?.name ?? `#${i + 1}`;
}

/** This viewer's engine seat index, or null for the moderator / spectator. */
export function myIndex(g: GameView): Seat | null {
  return g.viewer.kind === 'seat' ? g.viewer.seat : null;
}

export function isModerator(view: SeatView): boolean {
  return view.me.kind === 'moderator';
}

export function action<T extends AvailableAction['type']>(g: GameView, type: T): Extract<AvailableAction, { type: T }> | null {
  const a = g.me?.actions.find((x) => x.type === type);
  return (a as Extract<AvailableAction, { type: T }> | undefined) ?? null;
}

export function aliveSeats(g: GameView): Seat[] {
  return g.seats.filter((s) => s.alive).map((s) => s.seat);
}

export function grant(view: SeatView, channel: string): VoiceGrant | undefined {
  return view.voice.find((v) => v.channel === channel);
}

export function canSpeak(view: SeatView, channel: string): boolean {
  return grant(view, channel)?.speak === true;
}
export function canListen(view: SeatView, channel: string): boolean {
  return grant(view, channel)?.listen === true;
}

/** Roles present in this match (public: roleCounts). */
export function rolesInPlay(g: GameView): Role[] {
  return (Object.keys(g.roleCounts) as Role[]).filter((r) => g.roleCounts[r] > 0);
}

export function accusedOf(g: GameView): Seat | null {
  const s = g.step;
  return s.kind === 'day.defense' || s.kind === 'day.confirm' ? s.accused : null;
}

/** Latest public event of a type (for announcements). */
export function lastEvent<T extends GameView['publicLog'][number]['t']>(g: GameView, t: T) {
  for (let i = g.publicLog.length - 1; i >= 0; i--) {
    const e = g.publicLog[i]!;
    if (e.t === t) return e as Extract<GameView['publicLog'][number], { t: T }>;
  }
  return null;
}

export function secondsLeft(view: SeatView, now = Date.now()): number | null {
  return view.phaseEndsAt === null ? null : Math.max(0, Math.ceil((view.phaseEndsAt - now) / 1000));
}
