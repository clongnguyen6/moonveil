// Realtime client: one socket, seat token in localStorage, auto-resume after reload/network drop.
// The server sends full per-seat snapshots, so resuming = reconnect + `resume`; no client-side replay.
import {
  type ChatMessage,
  CLOSE,
  type ClientMessageInput,
  type ErrorCode,
  HEARTBEAT_MS,
  type Mode,
  type Pose,
  type Profile,
  type SeatId,
  type SeatView,
  type ServerMessage,
  type VoiceMode,
  WS_PATH,
} from '@moonveil/protocol';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'ended';

export interface ClientState {
  status: ConnStatus;
  code: string | null;
  view: SeatView | null;
  error: { code: ErrorCode | 'network'; message: string } | null;
  // Per channel, as the server sent it (history replaced on `chatlog`, live appended on `chat`).
  // Show only channels with a current `listen` grant in view.voice.
  chat: Record<string, ChatMessage[]>;
  // Server relay of speaking seats (to be replaced by SDK-scoped indicators with LiveKit, ADR 0004).
  speaking: SeatId[];
  voiceMode: VoiceMode;
  // serverNow ≈ Date.now() + serverOffsetMs (from `now` in state/hb frames).
  serverOffsetMs: number;
}

type Intent =
  | { t: 'create'; mode: Mode; profile: Profile; voiceMode?: VoiceMode }
  | { t: 'join'; code: string; profile: Profile }
  | { t: 'resume'; code: string; token: string };

const tokenKey = (code: string) => `moonveil.seat.${code}`;
export const storedToken = (code: string) => localStorage.getItem(tokenKey(code));

// Platform capabilities for the UI's fallbacks (mic check, copy link, wake lock). Secure context gates all three.
export function capabilities() {
  const n = navigator as Navigator & { wakeLock?: unknown };
  return {
    secureContext: globalThis.isSecureContext === true,
    microphone: typeof navigator.mediaDevices?.getUserMedia === 'function',
    clipboardWrite: typeof navigator.clipboard?.writeText === 'function',
    wakeLock: typeof n.wakeLock === 'object' && n.wakeLock !== null,
  };
}

// Base URL for invite links. A host browsing on localhost gets the server's LAN URL (if bound to the LAN),
// since a localhost link is useless to phones. Falls back to location.origin.
export async function inviteBase(): Promise<string> {
  const loopback = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  if (!loopback) return location.origin;
  try {
    const r = await fetch('/api/lan', { cache: 'no-store' });
    const { urls } = (await r.json()) as { urls: string[] };
    return urls[0] ?? location.origin;
  } catch {
    return location.origin;
  }
}

const BACKOFF = [250, 500, 1000, 2000, 4000];
const WATCHDOG_MS = HEARTBEAT_MS * 2.5;

export class Client {
  state: ClientState = { status: 'idle', code: null, view: null, error: null, chat: {}, speaking: [], voiceMode: 'remote', serverOffsetMs: 0 };
  private poseListeners = new Set<(poses: Pose[]) => void>();
  private ws: WebSocket | null = null;
  private intent: Intent | null = null;
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private lastMessageAt = 0;
  private listeners = new Set<() => void>();
  private url: string;

  constructor(url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_PATH}`) {
    this.url = url;
    // A socket may look open after a network change or a frozen tab; don't trust it.
    addEventListener('online', () => this.wake(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.wake(Date.now() - this.lastMessageAt > HEARTBEAT_MS * 1.5);
    });
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  // Poses arrive at up to 10 Hz; delivered to listeners (the scene), not stored in state.
  onPoses = (fn: (poses: Pose[]) => void) => {
    this.poseListeners.add(fn);
    return () => this.poseListeners.delete(fn);
  };
  serverNow = () => Date.now() + this.state.serverOffsetMs;

  private set(patch: Partial<ClientState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  create(mode: Mode, profile: Profile, voiceMode: VoiceMode = 'remote') {
    this.begin({ t: 'create', mode, profile, voiceMode });
  }
  join(code: string, profile: Profile) {
    this.begin({ t: 'join', code, profile });
  }
  // Returns false if this browser holds no seat for the room.
  resume(code: string): boolean {
    const token = storedToken(code);
    if (!token) return false;
    this.begin({ t: 'resume', code, token });
    return true;
  }
  // Take the seat back after another tab replaced this one.
  reclaim() {
    if (this.state.code && this.resume(this.state.code)) return;
    this.set({ status: 'ended' });
  }

  send(msg: ClientMessageInput): boolean {
    if (this.state.status !== 'open' || !this.ws) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  leave() {
    this.send({ t: 'leave' });
  }

  private begin(intent: Intent) {
    this.intent = intent;
    this.attempt = 0;
    this.set({ error: null, code: intent.t === 'create' ? null : intent.code, chat: {}, speaking: [] });
    this.open('connecting');
  }

  private wake(suspectOpen: boolean) {
    if (!this.intent) return;
    const st = this.state.status;
    if (st === 'open' && suspectOpen) return this.abandon();
    if (st === 'reconnecting' || st === 'connecting') {
      this.attempt = 0;
      this.open('reconnecting');
    }
  }

  // Drop a socket without waiting for onclose: a close handshake on a dead link can hang for a long time.
  private abandon() {
    const ws = this.ws;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = null;
    ws.close();
    this.ws = null;
    this.reconnectLater();
  }

  private reconnectLater() {
    this.clearTimers();
    this.set({ status: 'reconnecting' });
    const base = BACKOFF[Math.min(this.attempt++, BACKOFF.length - 1)]!;
    this.retry = setTimeout(() => this.open('reconnecting'), base + Math.random() * base * 0.3);
  }

  private open(status: ConnStatus) {
    this.clearTimers();
    this.ws?.close();
    const ws = new WebSocket(this.url);
    this.ws = ws;
    this.set({ status });
    ws.onopen = () => {
      if (this.intent) ws.send(JSON.stringify(this.intent));
      this.kick();
    };
    ws.onmessage = (ev) => {
      if (ws !== this.ws) return;
      this.kick();
      this.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
    };
    ws.onclose = (ev) => {
      if (ws !== this.ws) return;
      this.ws = null;
      this.clearTimers();
      if (ev.code === CLOSE.replaced) return this.set({ status: 'replaced' });
      if (ev.code === CLOSE.left || this.state.status === 'ended') return this.set({ status: 'ended' });
      if (!this.intent) return this.set({ status: 'idle' });
      this.reconnectLater();
    };
  }

  // Watchdog: a frozen/half-open socket shows no close event; server sends `hb` every HEARTBEAT_MS.
  private kick() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.lastMessageAt = Date.now();
    this.watchdog = setTimeout(() => this.abandon(), WATCHDOG_MS);
  }

  private clearTimers() {
    if (this.retry) clearTimeout(this.retry);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.retry = this.watchdog = null;
  }

  private onMessage(m: ServerMessage) {
    switch (m.t) {
      case 'welcome':
        if (m.token) localStorage.setItem(tokenKey(m.code), m.token);
        // Subsequent reconnects resume the seat, never re-create/re-join.
        this.intent = { t: 'resume', code: m.code, token: m.token ?? storedToken(m.code) ?? '' };
        this.attempt = 0;
        this.set({ status: 'open', code: m.code, error: null });
        if (location.pathname !== `/r/${m.code}`) history.replaceState(null, '', `/r/${m.code}`);
        return;
      case 'state':
        this.set({ view: m.view, voiceMode: m.view.voiceMode, serverOffsetMs: m.now - Date.now() });
        return;
      case 'chatlog':
        this.set({ chat: { ...this.state.chat, [m.channel]: m.messages } });
        return;
      case 'chat':
        this.set({ chat: { ...this.state.chat, [m.channel]: [...(this.state.chat[m.channel] ?? []), m.msg] } });
        return;
      case 'speaking':
        this.set({ speaking: m.seats });
        return;
      case 'poses':
        for (const fn of this.poseListeners) fn(m.poses);
        return;
      case 'error':
        this.set({ error: { code: m.code, message: m.message } });
        if (this.state.status !== 'open') {
          // Failed create/join/resume: stop retrying. Stale tokens are dropped.
          if (m.code === 'bad-token' || m.code === 'room-not-found') {
            if (this.state.code) localStorage.removeItem(tokenKey(this.state.code));
          }
          this.intent = null;
          this.set({ status: 'idle', view: null });
          this.ws?.close();
        }
        return;
      case 'bye':
        if (m.reason !== 'replaced' && this.state.code) localStorage.removeItem(tokenKey(this.state.code));
        if (m.reason !== 'replaced') {
          this.intent = null;
          this.set({ status: 'ended', view: null });
        }
        return;
      case 'hb':
        this.state = { ...this.state, serverOffsetMs: m.now - Date.now() };
        return;
      case 'ack':
        return;
    }
  }
}
