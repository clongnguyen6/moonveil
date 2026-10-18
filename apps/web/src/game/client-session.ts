// Session over the real socket client (apps/web/src/client.ts, foundation-4): chat/speaking/voiceMode/server
// clock come from ClientState; poses are delivered through client.onPoses (not stored, ≤ 10 Hz).
import type { ChatMessage, Mode, Pose, ProfileInput, VoiceMode } from '@moonveil/protocol';
import { type Client, inviteBase } from '../client.ts';
import { setServerOffset } from './clock.ts';
import { emptySession, type OutMessage, type Session, type SessionState } from './session.ts';
import type { ChannelId, ChatEntry } from './types.ts';

// Leaving: `leave()` remembers that THIS player chose to go (the server's bye reason can't say: a moderator's leave
// closes the room with reason 'closed'). When the session then ends, the UI goes home: entry screen, room code out of
// the URL (replaceState, so Back has no /r/<code> entry to resume). client.ts already dropped the resume token, the
// intent and voice on bye. Accidental drops (reconnecting) and replaced tabs never take this path.
const clearRoomFromUrl = () => { if (/^\/r\//.test(location.pathname)) history.replaceState(null, '', '/'); };

export function clientSession(client: Client): Session {
  let cached: SessionState | null = null;
  let leaving: string | null = null;              // room code the player asked to leave
  let home: { left: string | null } | null = null; // entry screen after an ended session, until the next begin
  const settle = () => {
    const s = client.getState();
    if (leaving && (s.status === 'reconnecting' || (s.status === 'open' && s.error))) leaving = null;   // leave did not happen
    if (leaving && s.status === 'ended') { home = { left: leaving }; leaving = null; clearRoomFromUrl(); }
  };
  const begin = () => { leaving = null; home = null; cached = null; };
  const listeners = new Set<() => void>();   // to re-render on goHome (no client change)
  let lastChat: Record<string, ChatMessage[]> | null = null;
  let chat: ChatEntry[] = [];
  return {
    subscribe: (fn) => {
      listeners.add(fn);
      const off = client.subscribe(() => { cached = null; settle(); fn(); });
      return () => { listeners.delete(fn); off(); };
    },
    getState() {
      if (cached) return cached;
      settle();
      const s = client.getState();
      if (home && (s.status === 'ended' || s.status === 'idle')) return (cached = { ...emptySession(), left: home.left });
      setServerOffset(s.serverOffsetMs);
      if (s.chat !== lastChat) {
        lastChat = s.chat;
        const listen = new Set(s.view?.voice.filter((v) => v.listen).map((v) => v.channel) ?? []);
        chat = Object.entries(s.chat).filter(([ch]) => listen.has(ch)).flatMap(([ch, msgs]) => msgs.map((msg) => ({ channel: ch as ChannelId, msg })));
      }
      // Server restart closes with 1012 (SIGTERM; the match is paused and restored): the overlay says "saved and paused".
      cached = { status: s.status, code: s.code, view: s.view, error: s.error, chat, speaking: s.speaking, poses: [], voiceMode: s.voiceMode, serverRestart: s.status === 'reconnecting' && s.lastCloseCode === 1012, voiceJoined: s.voiceJoined, voiceSessions: s.voiceSessions.length, voiceAvailable: s.view?.voiceAvailable };
      return cached;
    },
    create: (mode: Mode, profile: ProfileInput, voiceMode: VoiceMode = 'remote') => { begin(); client.create(mode, profile, voiceMode); },
    join: (code: string, profile: ProfileInput) => { begin(); client.join(code, profile); },
    resume: (code: string) => { begin(); return client.resume(code); },
    reclaim: () => client.reclaim(),
    leave: () => { leaving = client.getState().code; client.leave(); },
    goHome: () => { leaving = null; home = { left: null }; cached = null; clearRoomFromUrl(); for (const fn of listeners) fn(); },
    send: (msg: OutMessage) => client.send(msg),
    onPoses: (fn: (poses: Pose[]) => void) => client.onPoses(fn),
    inviteBase,
    voice: () => client.voice,
    voiceJoin: () => client.joinVoice(),
    voiceLeave: () => client.leaveVoice(),
  };
}
