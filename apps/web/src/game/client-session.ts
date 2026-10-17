// Session over the real socket client (apps/web/src/client.ts, foundation-4): chat/speaking/voiceMode/server
// clock come from ClientState; poses are delivered through client.onPoses (not stored, ≤ 10 Hz).
import type { ChatMessage, Mode, Pose, Profile, VoiceMode } from '@moonveil/protocol';
import { type Client, inviteBase } from '../client.ts';
import { setServerOffset } from './clock.ts';
import type { OutMessage, Session, SessionState } from './session.ts';
import type { ChannelId, ChatEntry } from './types.ts';

export function clientSession(client: Client): Session {
  let cached: SessionState | null = null;
  let lastChat: Record<string, ChatMessage[]> | null = null;
  let chat: ChatEntry[] = [];
  return {
    subscribe: (fn) => client.subscribe(() => { cached = null; fn(); }),
    getState() {
      if (cached) return cached;
      const s = client.getState();
      setServerOffset(s.serverOffsetMs);
      if (s.chat !== lastChat) {
        lastChat = s.chat;
        const listen = new Set(s.view?.voice.filter((v) => v.listen).map((v) => v.channel) ?? []);
        chat = Object.entries(s.chat).filter(([ch]) => listen.has(ch)).flatMap(([ch, msgs]) => msgs.map((msg) => ({ channel: ch as ChannelId, msg })));
      }
      // Server restart closes with 1012 (SIGTERM; the match is paused and restored): the overlay says "saved and paused".
      cached = { status: s.status, code: s.code, view: s.view, error: s.error, chat, speaking: s.speaking, poses: [], voiceMode: s.voiceMode, serverRestart: s.status === 'reconnecting' && s.lastCloseCode === 1012, voiceJoined: s.voiceJoined };
      return cached;
    },
    create: (mode: Mode, profile: Profile, voiceMode: VoiceMode = 'remote') => client.create(mode, profile, voiceMode),
    join: (code: string, profile: Profile) => client.join(code, profile),
    resume: (code: string) => client.resume(code),
    reclaim: () => client.reclaim(),
    leave: () => client.leave(),
    send: (msg: OutMessage) => client.send(msg),
    onPoses: (fn: (poses: Pose[]) => void) => client.onPoses(fn),
    inviteBase,
    voice: () => client.voice,
    voiceJoin: () => client.joinVoice(),
    voiceLeave: () => client.leaveVoice(),
  };
}
