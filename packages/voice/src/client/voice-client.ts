// VoiceClient: applies the server's VoiceSessions to LiveKit rooms in the browser. Holds no policy:
// the server decided the sessions, LiveKit enforces them; this only connects, publishes the mic where
// `speak` is granted, plays what arrives, and reports state for the UI. Framework-free; see react.ts.
//
// Dependencies on livekit-client are injected (defaults load it lazily) so unit tests run in Node.
import type { VoiceSession } from '../server/types.ts';

export type MicState = 'idle' | 'requesting' | 'granted' | 'denied' | 'failed';
export type ChannelState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export interface ParticipantView {
  identity: string;
  speaking: boolean;
}
export interface ChannelView {
  channel: string;
  room: string;
  state: ChannelState;
  speak: boolean;
  listen: boolean;
  visible: boolean;
  publishing: boolean;
  participants: ParticipantView[];
  error: string | null;
}
export interface VoiceSnapshot {
  channels: Record<string, ChannelView>;
  mic: MicState;
  micError: string | null;
  muted: boolean;
  // true when the browser refused autoplay; call unlockAudio() from a tap/click handler.
  audioBlocked: boolean;
}

// Minimal shape of livekit-client's Room / tracks that this client relies on.
export interface MicTrackLike {
  mute(): Promise<unknown>;
  unmute(): Promise<unknown>;
  stop(): void;
  readonly mediaStreamTrack: { readyState: string };
}
export interface RemoteTrackLike {
  kind: string;
  attach(): HTMLMediaElement;
  detach(): HTMLMediaElement[];
}
export interface RoomLike {
  connect(url: string, token: string, opts?: unknown): Promise<unknown>;
  disconnect(): Promise<unknown>;
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  readonly remoteParticipants: Map<string, { identity: string; isSpeaking: boolean }>;
  readonly activeSpeakers: { identity: string }[];
  readonly localParticipant: {
    publishTrack(track: MicTrackLike, opts?: unknown): Promise<unknown>;
    unpublishTrack(track: MicTrackLike, stop?: boolean): Promise<unknown>;
  };
  readonly canPlaybackAudio: boolean;
  startAudio(): Promise<void>;
}

// RoomEvent string values (livekit-client 2.x). Checked against the real enum in client.test.ts.
export const EV = {
  participantConnected: 'participantConnected',
  participantDisconnected: 'participantDisconnected',
  trackSubscribed: 'trackSubscribed',
  trackUnsubscribed: 'trackUnsubscribed',
  activeSpeakersChanged: 'activeSpeakersChanged',
  audioPlaybackChanged: 'audioPlaybackChanged',
  disconnected: 'disconnected',
  reconnecting: 'reconnecting',
  reconnected: 'reconnected',
  participantPermissionsChanged: 'participantPermissionsChanged',
} as const;

export interface VoiceClientOptions {
  createRoom?: () => RoomLike;
  createMicTrack?: () => Promise<MicTrackLike>;
  // Where remote audio elements go; null disables attaching (tests). Default: document.body.
  audioContainer?: HTMLElement | null;
  // Document for visibilitychange handling; null disables it (tests). Default: globalThis.document.
  document?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null;
  onError?: (channel: string, err: unknown) => void;
}

interface Chan {
  session: VoiceSession;
  room: RoomLike;
  view: ChannelView;
  mic: MicTrackLike | null;
  detach: (() => void)[];
  listeners: [string, (...args: any[]) => void][];
}

const noopDoc: VoiceClientOptions['document'] = null;

export class VoiceClient {
  private readonly opts: VoiceClientOptions;
  private readonly chans = new Map<string, Chan>();
  private readonly subs = new Set<() => void>();
  private snapshot: VoiceSnapshot = { channels: {}, mic: 'idle', micError: null, muted: false, audioBlocked: false };
  private mic: MicState = 'idle';
  private micError: string | null = null;
  private muted = false;
  private disposed = false;
  private chain: Promise<void> = Promise.resolve();
  private readonly onVisibility = () => void this.reacquireMicIfNeeded();

  constructor(opts: VoiceClientOptions = {}) {
    this.opts = opts;
    const doc = opts.document === undefined ? (typeof document !== 'undefined' ? document : noopDoc) : opts.document;
    doc?.addEventListener('visibilitychange', this.onVisibility);
  }

  // --- store API (useSyncExternalStore-compatible) ---
  subscribe = (cb: () => void): (() => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  getSnapshot = (): VoiceSnapshot => this.snapshot;

  // --- commands ---

  // Apply the server's current sessions. Serialized: a second call waits for the first.
  applySessions(sessions: readonly VoiceSession[]): Promise<void> {
    this.chain = this.chain.then(() => this.reconcile(sessions)).catch((err) => this.opts.onError?.('*', err));
    return this.chain;
  }

  // Must be called from a user gesture when `audioBlocked` is true.
  async unlockAudio(): Promise<void> {
    await Promise.all([...this.chans.values()].map((c) => c.room.startAudio().catch((err) => this.opts.onError?.(c.session.channel, err))));
    this.publish();
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted;
    for (const c of this.chans.values()) if (c.mic) await (muted ? c.mic.mute() : c.mic.unmute()).catch((err) => this.opts.onError?.(c.session.channel, err));
    this.publish();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const doc = this.opts.document === undefined ? (typeof document !== 'undefined' ? document : noopDoc) : this.opts.document;
    doc?.removeEventListener('visibilitychange', this.onVisibility);
    await this.chain;
    await Promise.all([...this.chans.keys()].map((ch) => this.drop(ch)));
    this.publish();
  }

  // --- internals ---

  private async reconcile(sessions: readonly VoiceSession[]): Promise<void> {
    if (this.disposed) return;
    const wanted = new Map(sessions.map((s) => [s.channel, s]));
    // Drop channels that are gone or whose room changed (rotation) or whose connection died.
    for (const [ch, c] of [...this.chans]) {
      const s = wanted.get(ch);
      const dead = c.view.state === 'disconnected' || c.view.state === 'failed';
      if (!s || s.room !== c.session.room || (dead && s.token !== c.session.token)) await this.drop(ch);
    }
    for (const s of wanted.values()) {
      const c = this.chans.get(s.channel);
      if (!c) await this.join(s);
      else await this.follow(c, s);
    }
    this.publish();
  }

  private async join(s: VoiceSession): Promise<void> {
    const room = this.opts.createRoom ? this.opts.createRoom() : await defaultCreateRoom();
    const c: Chan = {
      session: s,
      room,
      view: { channel: s.channel, room: s.room, state: 'connecting', speak: s.speak, listen: s.listen, visible: s.visible, publishing: false, participants: [], error: null },
      mic: null,
      detach: [],
      listeners: [],
    };
    this.chans.set(s.channel, c);
    this.wire(c);
    this.publish();
    try {
      await room.connect(s.url, s.token, { autoSubscribe: true });
      c.view.state = 'connected';
      this.refreshParticipants(c);
      if (s.speak) await this.publishMic(c);
    } catch (err) {
      c.view.state = 'failed';
      c.view.error = String((err as Error)?.message ?? err);
      this.opts.onError?.(s.channel, err);
    }
    this.publish();
  }

  private async follow(c: Chan, s: VoiceSession): Promise<void> {
    c.session = s;
    c.view.speak = s.speak;
    c.view.listen = s.listen;
    c.view.visible = s.visible;
    if (s.speak && !c.mic) await this.publishMic(c);
    if (!s.speak && c.mic) await this.unpublishMic(c);
  }

  private async drop(ch: string): Promise<void> {
    const c = this.chans.get(ch);
    if (!c) return;
    this.chans.delete(ch);
    for (const [ev, fn] of c.listeners) c.room.off(ev, fn);
    for (const d of c.detach) d();
    if (c.mic) {
      c.mic.stop();
      c.mic = null;
    }
    await c.room.disconnect().catch(() => undefined);
    this.publish();
  }

  private wire(c: Chan): void {
    const on = (ev: string, fn: (...args: any[]) => void) => {
      c.room.on(ev, fn);
      c.listeners.push([ev, fn]);
    };
    on(EV.participantConnected, () => this.refreshParticipants(c));
    on(EV.participantDisconnected, () => this.refreshParticipants(c));
    on(EV.activeSpeakersChanged, () => this.refreshParticipants(c));
    on(EV.trackSubscribed, (track: RemoteTrackLike) => {
      if (track.kind !== 'audio') return;
      const container = this.opts.audioContainer === undefined ? (typeof document !== 'undefined' ? document.body : null) : this.opts.audioContainer;
      if (!container) return;
      const el = track.attach();
      el.setAttribute('data-voice-channel', c.session.channel);
      container.appendChild(el);
      c.detach.push(() => track.detach().forEach((e) => e.remove()));
    });
    on(EV.trackUnsubscribed, (track: RemoteTrackLike) => {
      if (track.kind === 'audio') track.detach().forEach((e) => e.remove());
    });
    on(EV.audioPlaybackChanged, () => this.publish());
    on(EV.reconnecting, () => {
      c.view.state = 'reconnecting';
      this.publish();
    });
    on(EV.reconnected, () => {
      c.view.state = 'connected';
      this.refreshParticipants(c);
    });
    on(EV.disconnected, (reason?: unknown) => {
      c.view.state = 'disconnected';
      c.view.error = reason === undefined ? null : String(reason);
      c.view.participants = [];
      this.publish();
    });
  }

  private refreshParticipants(c: Chan): void {
    const speaking = new Set(c.room.activeSpeakers.map((p) => p.identity));
    c.view.participants = [...c.room.remoteParticipants.values()].map((p) => ({ identity: p.identity, speaking: speaking.has(p.identity) || p.isSpeaking })).sort((a, b) => a.identity.localeCompare(b.identity));
    this.publish();
  }

  private async publishMic(c: Chan): Promise<void> {
    if (this.mic === 'denied') return; // the user said no; do not nag per channel
    this.mic = this.mic === 'granted' ? 'granted' : 'requesting';
    this.publish();
    try {
      const track = this.opts.createMicTrack ? await this.opts.createMicTrack() : await defaultCreateMicTrack();
      if (this.muted) await track.mute();
      await c.room.localParticipant.publishTrack(track, { source: 'microphone' });
      c.mic = track;
      c.view.publishing = true;
      this.mic = 'granted';
      this.micError = null;
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      const msg = String((err as Error)?.message ?? err);
      this.mic = name === 'NotAllowedError' || /denied|permission/i.test(msg) ? 'denied' : 'failed';
      this.micError = msg;
      this.opts.onError?.(c.session.channel, err);
    }
    this.publish();
  }

  private async unpublishMic(c: Chan): Promise<void> {
    if (!c.mic) return;
    const t = c.mic;
    c.mic = null;
    c.view.publishing = false;
    await c.room.localParticipant.unpublishTrack(t, true).catch((err) => this.opts.onError?.(c.session.channel, err));
    this.publish();
  }

  // iOS Safari ends or mutes capture when the page is hidden; re-acquire when it comes back.
  async reacquireMicIfNeeded(): Promise<void> {
    const doc = this.opts.document === undefined ? (typeof document !== 'undefined' ? document : noopDoc) : this.opts.document;
    if (doc && doc.visibilityState !== 'visible') return;
    for (const c of this.chans.values()) {
      if (c.session.speak && c.mic && c.mic.mediaStreamTrack.readyState === 'ended') {
        await this.unpublishMic(c);
        await this.publishMic(c);
      }
    }
  }

  private publish(): void {
    const channels: Record<string, ChannelView> = {};
    let blocked = false;
    for (const [ch, c] of this.chans) {
      channels[ch] = { ...c.view, participants: c.view.participants.map((p) => ({ ...p })) };
      if (c.view.state === 'connected' && !c.room.canPlaybackAudio) blocked = true;
    }
    this.snapshot = { channels, mic: this.mic, micError: this.micError, muted: this.muted, audioBlocked: blocked };
    for (const cb of this.subs) cb();
  }
}

async function defaultCreateRoom(): Promise<RoomLike> {
  const { Room } = await import('livekit-client');
  return new Room({ adaptiveStream: false, dynacast: false }) as unknown as RoomLike;
}

async function defaultCreateMicTrack(): Promise<MicTrackLike> {
  const { createLocalAudioTrack } = await import('livekit-client');
  return (await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true })) as unknown as MicTrackLike;
}
