// What the UI talks to. The real implementation wraps apps/web/src/client.ts (foundation); the dev stub
// (./stub) implements the same surface in-browser. Keeping the UI on this interface means screens never
// know whether a socket or a stub is behind them.
import type { ClientMessageInput, ErrorCode, Mode, Pose, Profile, SeatId, SeatView, VoiceMode } from '@moonveil/protocol';
import type { VoiceClient } from '@moonveil/voice/client';
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
  /** True while reconnecting after a server restart (close code 1012): the match is paused server-side. False for a
   *  local drop, where timers keep running (approved). Needs foundation's `lastCloseCode` (PROPOSALS P15); false until then. */
  serverRestart: boolean;
  /** Latest `poses` frame (lobby: everyone; play: only what the server lets this seat see). */
  poses: Pose[];
  /** Room voice setting (APPROVED): 'remote' = in-game voice, 'inPerson' = voice off, text only. */
  voiceMode: VoiceMode;
}

export interface Session {
  subscribe(fn: () => void): () => void;
  getState(): SessionState;
  create(mode: Mode, profile: Profile, voiceMode?: VoiceMode): void;
  join(code: string, profile: Profile): void;
  resume(code: string): boolean;
  reclaim(): void;
  leave(): void;
  send(msg: OutMessage): boolean;
  /** Invite link origin (LAN URL when the host browses on localhost); absent on the stub. */
  inviteBase?(): Promise<string>;
  /** The one VoiceClient (client.ts creates it lazily); null until voice sessions arrive. Absent on the stub. */
  voice?(): VoiceClient | null;
  /** Pose frames (≤ 10 Hz) for the scene; absent on the stub. */
  onPoses?(fn: (poses: Pose[]) => void): () => void;
}

export function emptySession(): SessionState {
  return { status: 'idle', code: null, view: null, error: null, chat: [], speaking: [], poses: [], voiceMode: 'remote', serverRestart: false };
}
