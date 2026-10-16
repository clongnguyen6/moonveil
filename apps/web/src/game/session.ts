// What the UI talks to. The real implementation wraps apps/web/src/client.ts (foundation); the dev stub
// (./stub) implements the same surface in-browser. Keeping the UI on this interface means screens never
// know whether a socket or a stub is behind them.
import type { ClientMessageInput, ErrorCode, Mode, Profile, SeatId, SeatView } from '@moonveil/protocol';
import type { ChannelId, ChatMessage } from './types.ts';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'ended';

/** PROPOSED additions to ClientMessage (docs/ui/PROPOSALS.md P1, P2). */
export type ProposedMessage =
  | { t: 'moderate'; ref?: string; action: unknown }
  | { t: 'chat'; ref?: string; channel: ChannelId; text: string };
export type OutMessage = ClientMessageInput | ProposedMessage;

export interface SessionState {
  status: ConnStatus;
  code: string | null;
  view: SeatView | null;
  error: { code: ErrorCode | 'network' | string; message: string } | null;
  /** Grant-filtered chat history + live messages (proposal P2). Empty until the server supports it. */
  chat: ChatMessage[];
  /** Seats currently speaking on channels this seat may listen to (proposal P4). */
  speaking: SeatId[];
  /** Room voice setting (proposal P3): 'remote' = in-game voice, 'inPerson' = voice off, text only. */
  voiceMode: 'remote' | 'inPerson';
}

export interface Session {
  subscribe(fn: () => void): () => void;
  getState(): SessionState;
  create(mode: Mode, profile: Profile): void;
  join(code: string, profile: Profile): void;
  resume(code: string): boolean;
  reclaim(): void;
  leave(): void;
  send(msg: OutMessage): boolean;
}

export function emptySession(): SessionState {
  return { status: 'idle', code: null, view: null, error: null, chat: [], speaking: [], voiceMode: 'remote' };
}
