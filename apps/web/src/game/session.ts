// What the UI talks to. The real implementation wraps apps/web/src/client.ts (foundation); the dev stub
// (./stub) implements the same surface in-browser. Keeping the UI on this interface means screens never
// know whether a socket or a stub is behind them.
import type { ClientMessageInput, ErrorCode, Mode, Pose, Profile, SeatId, SeatView } from '@moonveil/protocol';
import type { ChatEntry } from './types.ts';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'ended';

/** Wire messages (foundation-3 protocol): moderator commands travel as `act`; chat is `say`. */
export type OutMessage = ClientMessageInput;

export interface SessionState {
  status: ConnStatus;
  code: string | null;
  view: SeatView | null;
  error: { code: ErrorCode | 'network' | string; message: string } | null;
  /** Chat per channel, as delivered by `chatlog` (replaces) + `chat` (appends). Only channels with a listen grant. */
  chat: ChatEntry[];
  /** Seats currently speaking on channels this seat may listen to (`speaking` frame). */
  speaking: SeatId[];
  /** Latest `poses` frame (lobby: everyone; play: only what the server lets this seat see). */
  poses: Pose[];
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
  return { status: 'idle', code: null, view: null, error: null, chat: [], speaking: [], poses: [], voiceMode: 'remote' };
}
