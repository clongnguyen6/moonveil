// Pure selectors over SeatView + rules projection. No caching, no inference beyond what the view states.
import { type PublicSeat, type SeatId, type SeatView, type VoiceGrant, gameView } from '@moonveil/protocol';
import type { AvailableAction, Role, Seat } from '@moonveil/rules';
import type { GameView } from './types.ts';

export function projection(view: SeatView | null): GameView | null {
  return view ? gameView(view) : null;
}

/** Display name for a seat id: player, or the moderator. */
export function nameOf(view: SeatView, id: SeatId): string {
  return view.players.find((p) => p.seat === id)?.name ?? view.moderator?.name ?? id;
}

/** Chat sender: name AND look come from the one seat `msg.from` (never mix `msg.name` with another seat's look).
 *  `player` is null when the seat is gone from the view (left the lobby); then only the send-time name is shown. */
export function senderOf(view: SeatView, msg: { from: SeatId; name: string }): { name: string; player: PublicSeat | null } {
  const p = view.players.find((x) => x.seat === msg.from) ?? null;
  return { name: p?.name ?? msg.name, player: p };
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

/** The public dawn report that opened the current day (night N's dawn opens day N), or null (night, day 0, no dawn yet).
 *  Only the public seats list: never the cause. */
export function dawnOfToday(g: GameView): { night: number; dead: Seat[] } | null {
  if (!g.step.kind.startsWith('day.')) return null;
  for (let i = g.publicLog.length - 1; i >= 0; i--) {
    const e = g.publicLog[i]!;
    if (e.t === 'dawn') return e.night === g.day ? { night: e.night, dead: [...e.dead] } : null;
  }
  return null;
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
