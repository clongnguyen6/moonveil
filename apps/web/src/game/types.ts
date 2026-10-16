// Types the UI renders from. `GameView` is the rules projection the server puts in `SeatView.game`.
// The UI reads ONLY what the projection gives this seat; nothing secret is inferred or cached here.
import type { HostView } from '@moonveil/rules';
import type { ChatMessage as ProtoChat, SeatId, SeatView } from '@moonveil/protocol';

export type GameView = HostView;
export type { SeatView, SeatId };

export type ChannelId = 'public' | 'wolves' | 'ghosts';

/** Protocol ChatMessage + its channel (server sends `chat`/`chatlog` only for channels this seat may listen to). */
export interface ChatEntry {
  channel: ChannelId;
  msg: ProtoChat;
}
export type { ProtoChat as ChatMessage };

export type StepFamily = 'night' | 'hunter' | 'day' | 'ended';

export function stepFamily(kind: GameView['step']['kind']): StepFamily {
  if (kind === 'night.main' || kind === 'night.witch') return 'night';
  if (kind === 'hunter') return 'hunter';
  if (kind === 'ended') return 'ended';
  return 'day';
}
