// APPROVED Q25 (2026-10-16): voice and text channel grants. Fixed behaviour; one function.
// Provisional only: whether the moderator may speak in public (moderator.speaksInPublic).
import type { MatchState } from './types.ts';

export type ChannelId = 'public' | 'wolves' | 'ghosts';
/** Structurally identical to @moonveil/protocol VoiceGrant. Applies to voice and text alike. */
export interface ChannelGrant {
  channel: ChannelId;
  listen: boolean;
  speak: boolean;
}
export type ChannelViewer = { kind: 'seat'; seat: number } | { kind: 'moderator' };

/** APPROVED Q06: dead Hunter whose shot is still pending (no ghost channel, no ghost-only knowledge yet). */
export function isPendingHunter(state: MatchState, seat: number): boolean {
  return state.step.kind === 'hunter' && state.step.pending.includes(seat);
}

/**
 * Day (discussion, votes, Hunter turn): living speak + listen in public.
 * Night: only living wolves, on 'wolves'; nobody else speaks.
 * Defense: only the accused speaks in public; other living listen.
 * Ghosts: speak + listen on 'ghosts', listen to public; never 'wolves'. A pending Hunter gets public-listen only.
 * Moderator: listens to every channel; speaking in public is provisional.
 * Match end: everyone public (the server opens the room).
 */
export function channelsFor(state: MatchState, viewer: ChannelViewer): ChannelGrant[] {
  const step = state.step;
  if (step.kind === 'ended') return [{ channel: 'public', listen: true, speak: true }];

  if (viewer.kind === 'moderator') {
    return [
      { channel: 'public', listen: true, speak: state.config.moderator.speaksInPublic },
      { channel: 'wolves', listen: true, speak: false },
      { channel: 'ghosts', listen: true, speak: false },
    ];
  }

  const me = state.seats[viewer.seat];
  if (!me) return [];
  if (!me.alive) {
    if (isPendingHunter(state, me.seat)) return [{ channel: 'public', listen: true, speak: false }];
    return [
      { channel: 'public', listen: true, speak: false },
      { channel: 'ghosts', listen: true, speak: true },
    ];
  }
  if (step.kind === 'night.main' || step.kind === 'night.witch') {
    return me.role === 'wolf' ? [{ channel: 'wolves', listen: true, speak: true }] : [];
  }
  if (step.kind === 'day.defense') return [{ channel: 'public', listen: true, speak: me.seat === step.accused }];
  return [{ channel: 'public', listen: true, speak: true }];
}
