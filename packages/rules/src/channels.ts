// Q25: who may listen/speak on which voice/text channel now. One isolated policy function.
// Approved (brief): ghosts talk on 'ghosts', hear 'public', never hear 'wolves'; living never hear ghosts.
import type { MatchState } from './types.ts';

export type ChannelId = 'public' | 'wolves' | 'ghosts';
/** Structurally identical to @moonveil/protocol VoiceGrant. */
export interface ChannelGrant {
  channel: ChannelId;
  listen: boolean;
  speak: boolean;
}
export type ChannelViewer = { kind: 'seat'; seat: number } | { kind: 'moderator' };

export function channelsFor(state: MatchState, viewer: ChannelViewer): ChannelGrant[] {
  const c = state.config.comms;
  const step = state.step;
  const night = step.kind === 'night.main' || step.kind === 'night.witch';
  if (step.kind === 'ended') return [{ channel: 'public', listen: true, speak: true }];

  if (viewer.kind === 'moderator') {
    const out: ChannelGrant[] = [{ channel: 'public', listen: true, speak: true }];
    if (c.moderatorHearsAll) {
      out.push({ channel: 'wolves', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: false });
    }
    return out;
  }

  const me = state.seats[viewer.seat];
  if (!me) return [];
  if (!me.alive) {
    // F1: a Hunter whose shot is pending hears public only, so ghost chat cannot inform the shot.
    if (step.kind === 'hunter' && step.pending.includes(me.seat) && !c.pendingHunterJoinsGhosts) {
      return [{ channel: 'public', listen: true, speak: false }];
    }
    return [
      { channel: 'public', listen: true, speak: false },
      { channel: 'ghosts', listen: true, speak: true },
    ];
  }
  if (night) {
    const out: ChannelGrant[] = [];
    if (c.livingHearPublicAtNight) out.push({ channel: 'public', listen: true, speak: false });
    if (c.wolvesAtNight && me.role === 'wolf') out.push({ channel: 'wolves', listen: true, speak: true });
    return out;
  }
  if (step.kind === 'day.defense' && c.defenseOnlyAccusedSpeaks) {
    return [{ channel: 'public', listen: true, speak: me.seat === step.accused }];
  }
  return [{ channel: 'public', listen: true, speak: true }];
}
