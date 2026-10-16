// Session over the real socket client (apps/web/src/client.ts, foundation). Adds chat/speaking state from
// the `chatlog`/`chat`/`speaking` frames. INTERIM: the Client exposes no frame hook, so this taps the socket's
// message events (addEventListener, never replacing the Client's handler). See docs/ui/PROPOSALS.md P2.
import type { ChatMessage, Mode, Pose, Profile, SeatId, ServerMessage } from '@moonveil/protocol';
import type { Client } from '../client.ts';
import type { OutMessage, Session, SessionState } from './session.ts';
import type { ChannelId, ChatEntry } from './types.ts';

export function clientSession(client: Client): Session {
  const listeners = new Set<() => void>();
  let chat: ChatEntry[] = [];
  let speaking: SeatId[] = [];
  let poses: Pose[] = [];
  let tapped: WebSocket | null = null;
  let cached: SessionState | null = null;
  let lastClient = client.getState();

  const emit = () => {
    cached = null;
    for (const fn of listeners) fn();
  };

  const onFrame = (ev: MessageEvent) => {
    let m: ServerMessage;
    try {
      m = JSON.parse(String(ev.data)) as ServerMessage;
    } catch {
      return;
    }
    if (m.t === 'chatlog') {
      const ch = m.channel as ChannelId;
      chat = [...chat.filter((c) => c.channel !== ch), ...m.messages.map((msg: ChatMessage) => ({ channel: ch, msg }))];
      emit();
    } else if (m.t === 'chat') {
      chat = [...chat, { channel: m.channel as ChannelId, msg: m.msg }];
      emit();
    } else if (m.t === 'speaking') {
      speaking = m.seats;
      emit();
    } else if (m.t === 'poses') {
      poses = m.poses;
      emit();
    } else if (m.t === 'welcome') {
      chat = [];
      speaking = [];
      poses = [];
    }
  };

  // Re-tap whenever the Client swaps its socket (reconnect). The Client notifies on every status change.
  const tap = () => {
    const ws = (client as unknown as { ws: WebSocket | null }).ws;
    if (ws && ws !== tapped) {
      ws.addEventListener('message', onFrame);
      tapped = ws;
    }
  };
  client.subscribe(() => {
    tap();
    const s = client.getState();
    if (s.view && lastClient.view) {
      // Drop channels whose listen grant went away (the server stops sending them; history must not linger).
      const listen = new Set(s.view.voice.filter((v) => v.listen).map((v) => v.channel));
      const kept = chat.filter((c) => listen.has(c.channel));
      if (kept.length !== chat.length) chat = kept;
    }
    if (!s.view) {
      chat = [];
      speaking = [];
      poses = [];
    }
    lastClient = s;
    emit();
  });

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    getState() {
      if (cached) return cached;
      const s = client.getState();
      cached = { status: s.status, code: s.code, view: s.view, error: s.error, chat, speaking, poses, voiceMode: 'remote' };
      return cached;
    },
    create: (mode: Mode, profile: Profile) => client.create(mode, profile),
    join: (code: string, profile: Profile) => client.join(code, profile),
    resume: (code: string) => client.resume(code),
    reclaim: () => client.reclaim(),
    leave: () => client.leave(),
    send: (msg: OutMessage) => client.send(msg),
  };
}
