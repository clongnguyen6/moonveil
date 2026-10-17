// D2 (UI P16): the real web client (apps/web/src/client.ts) against a real server with voice sessions, in Node with a
// fake LiveKit room and mic injected via the client's voice options. Sessions arrive but nothing connects and no mic
// is requested until joinVoice(); leaveVoice() disconnects and releases the mic; leaving the room leaves voice.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { createMoonveilServer } from '../src/server.ts';
import { recordingVoiceGateway } from '../src/voice.ts';
import { listenFree } from './ports.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  location: { protocol: 'http:', host: 'x', hostname: 'x', pathname: '/', origin: 'http://x' },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  history: { replaceState: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible' },
  addEventListener: () => {},
});

class FakeRoom extends EventEmitter {
  connected: { url: string; token: string } | null = null;
  disconnects = 0;
  remoteParticipants = new Map<string, { identity: string; isSpeaking: boolean }>();
  activeSpeakers: { identity: string }[] = [];
  canPlaybackAudio = true;
  localParticipant = { publishTrack: async () => {}, unpublishTrack: async () => {} };
  async connect(url: string, token: string) {
    this.connected = { url, token };
  }
  async disconnect() {
    this.disconnects++;
    this.connected = null;
  }
  async startAudio() {}
}
class FakeMic {
  muted = false;
  stopped = false;
  mediaStreamTrack = { readyState: 'live' };
  async mute() {}
  async unmute() {}
  stop() {
    this.stopped = true;
  }
}

interface Snapshot { joined: boolean; pendingChannels: string[]; channels: Record<string, { state: string }> }
interface WebClient {
  getState(): { status: string; voiceJoined: boolean; voiceSessions: { channel: string }[] };
  voice: { getSnapshot(): Snapshot } | null;
  create(mode: 'automatic', profile: { name: string; appearance: { color: string; hat: string } }): void;
  joinVoice(): Promise<void>;
  leaveVoice(): Promise<void>;
  leave(): void;
}
// Non-literal specifier: the server's tsconfig has no DOM lib, so it must not typecheck client.ts (the web build does).
const clientModule = '../../web/src/client.ts';
const { Client } = (await import(clientModule)) as { Client: new (url: string, voiceOpts: unknown) => WebClient };

const until = async (f: () => boolean, what: string) => {
  for (let i = 0; i < 300 && !f(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(f(), what);
};

test('D2: sessions held until joinVoice (no connect, no mic); join connects + mic; leaveVoice disconnects + releases; room leave leaves voice', async () => {
  const rec = recordingVoiceGateway();
  const srv = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown>, voice: rec.gateway });
  const port = await listenFree(srv.http);
  const rooms: FakeRoom[] = [];
  const mics: FakeMic[] = [];
  const c = new Client(`ws://127.0.0.1:${port}/ws`, {
    createRoom: () => (rooms.push(new FakeRoom()), rooms.at(-1)),
    createMicTrack: async () => (mics.push(new FakeMic()), mics.at(-1)),
    audioContainer: null,
  });
  try {
    c.create('automatic', { name: 'Ann', appearance: { color: 'moss', hat: 'none' } });
    await until(() => c.getState().voiceSessions.length > 0 && c.voice !== null, 'lobby voice sessions arrived');
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(c.getState().voiceJoined, false);
    assert.equal(c.voice!.getSnapshot().joined, false);
    assert.deepEqual(c.voice!.getSnapshot().pendingChannels, ['public'], 'sessions held');
    assert.equal(rooms.length, 0, 'no voice connection before join');
    assert.equal(mics.length, 0, 'no microphone before join');

    await c.joinVoice();
    assert.equal(c.getState().voiceJoined, true);
    assert.equal(c.voice!.getSnapshot().joined, true);
    assert.equal(rooms.length, 1);
    assert.match(rooms[0]!.connected?.token ?? '', /^tok-.*-public-/, 'connected with this seat\'s public token');
    await until(() => mics.length === 1, 'mic requested on join (public speak in the lobby)');

    await c.leaveVoice();
    assert.equal(c.getState().voiceJoined, false);
    assert.equal(c.voice!.getSnapshot().joined, false);
    assert.equal(rooms[0]!.connected, null, 'disconnected');
    assert.ok(mics[0]!.stopped, 'mic released');

    await c.joinVoice();
    await until(() => rooms.some((r) => r.connected !== null), 'rejoined');
    c.leave();
    await until(() => c.getState().status === 'ended', 'left the room');
    await until(() => !c.getState().voiceJoined && rooms.every((r) => r.connected === null), 'room leave leaves voice');
  } finally {
    await srv.stop();
  }
});
