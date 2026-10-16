// Types the UI renders from. `GameView` is the rules projection the server puts in `SeatView.game`.
// The UI reads ONLY what the projection gives this seat; nothing secret is inferred or cached here.
import type { HostView } from '@moonveil/rules';
import type { SeatId, SeatView } from '@moonveil/protocol';

export type GameView = HostView;
export type { SeatView, SeatId };

export type ChannelId = 'public' | 'wolves' | 'ghosts';

/** PROPOSED server->client chat frame (docs/ui/PROPOSALS.md P2). Delivered only to seats whose grant has listen. */
export interface ChatMessage {
  id: string;
  channel: ChannelId;
  from: { seat: SeatId | null; name: string }; // seat null = moderator or system
  text: string;
  at: number; // server epoch ms
}

export type StepFamily = 'night' | 'hunter' | 'day' | 'ended';

export function stepFamily(kind: GameView['step']['kind']): StepFamily {
  if (kind === 'night.main' || kind === 'night.witch') return 'night';
  if (kind === 'hunter') return 'hunter';
  if (kind === 'ended') return 'ended';
  return 'day';
}
