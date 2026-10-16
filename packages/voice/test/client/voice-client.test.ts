// VoiceClient unit tests with a fake Room: no browser, no LiveKit.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { EV, type MicTrackLike, normalizeSession, type RoomLike, roomFromToken, VoiceClient } from '../../src/client/voice-client.ts';
import type { VoiceSession } from '../../src/server/types.ts';

class FakeMic implements MicTrackLike {
  muted = false;
  stopped = false;
  mediaStreamTrack = { readyState: 'live' };
  async mute() {
    this.muted = true;
  }
  async unmute() {
    this.muted = false;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeRoom extends EventEmitter implements RoomLike {
  connected: { url: string; token: string } | null = null;
  disconnected = 0;
  published: MicTrackLike[] = [];
  unpublished: MicTrackLike[] = [];
  remoteParticipants = new Map<string, { identity: string; isSpeaking: boolean }>();
  activeSpeakers: { identity: string }[] = [];
  canPlaybackAudio = true;
  startAudioCalls = 0;
  failConnect: string | null = null;
  localParticipant = {
    publishTrack: async (t: MicTrackLike) => {
      this.published.push(t);
    },
    unpublishTrack: async (t: MicTrackLike) => {
      this.unpublished.push(t);
    },
  };
  async connect(url: string, token: string) {
    if (this.failConnect) throw new Error(this.failConnect);
    this.connected = { url, token };
  }
  async disconnect() {
    this.disconnected++;
    this.connected = null;
  }
  async startAudio() {
    this.startAudioCalls++;
    this.canPlaybackAudio = true;
  }
  override on(event: string, listener: (...args: any[]) => void) {
    return super.on(event, listener);
  }
  override off(event: string, listener: (...args: any[]) => void) {
    return super.off(event, listener);
  }
}

const S = (channel: string, room: string, speak: boolean, listen = true, visible = true, token = `tok-${room}`): VoiceSession => ({ channel, room, url: 'wss://x', token, speak, listen, visible });

function make(micFactory?: () => Promise<MicTrackLike>) {
  const rooms: FakeRoom[] = [];
  const mics: FakeMic[] = [];
  const client = new VoiceClient({
    createRoom: () => {
      const r = new FakeRoom();
      rooms.push(r);
      return r;
    },
    createMicTrack:
      micFactory ??
      (async () => {
        const m = new FakeMic();
        mics.push(m);
        return m;
      }),
    audioContainer: null,
    document: null,
  });
  return { client, rooms, mics };
}

test('applySessions connects one room per session and publishes the mic only where speak is granted', async () => {
  const { client, rooms, mics } = make();
  await client.applySessions([S('public', 'R-public-g1', true), S('wolves', 'R-wolves-g1', false)]);
  assert.equal(rooms.length, 2);
  assert.deepEqual(rooms.map((r) => r.connected?.token), ['tok-R-public-g1', 'tok-R-wolves-g1']);
  assert.equal(rooms[0]!.published.length, 1);
  assert.equal(rooms[1]!.published.length, 0);
  assert.equal(mics.length, 1);
  const snap = client.getSnapshot();
  assert.equal(snap.mic, 'granted');
  assert.equal(snap.channels.public?.state, 'connected');
  assert.equal(snap.channels.public?.publishing, true);
  assert.equal(snap.channels.wolves?.publishing, false);
});

test('speak revoked -> mic unpublished; speak granted again -> republished; same room kept', async () => {
  const { client, rooms } = make();
  await client.applySessions([S('public', 'R-public-g1', true)]);
  await client.applySessions([S('public', 'R-public-g1', false, true, true, 'tok2')]);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0]!.unpublished.length, 1);
  assert.equal(client.getSnapshot().channels.public?.publishing, false);
  await client.applySessions([S('public', 'R-public-g1', true, true, true, 'tok3')]);
  assert.equal(rooms[0]!.published.length, 2);
});

test('rotation (new room name) reconnects; a dropped session disconnects and removes the channel', async () => {
  const { client, rooms } = make();
  await client.applySessions([S('public', 'R-public-g1', true), S('ghosts', 'R-ghosts-g1', true)]);
  await client.applySessions([S('public', 'R-public-g2', false, true, false)]);
  assert.equal(rooms[0]!.disconnected, 1); // old public
  assert.equal(rooms[1]!.disconnected, 1); // ghosts gone
  assert.equal(rooms.length, 3);
  assert.equal(rooms[2]!.connected?.token, 'tok-R-public-g2');
  const snap = client.getSnapshot();
  assert.deepEqual(Object.keys(snap.channels), ['public']);
  assert.equal(snap.channels.public?.visible, false);
  assert.equal(snap.channels.public?.room, 'R-public-g2');
});

test('empty sessions (night villager, in-person) leaves no channels and no mic', async () => {
  const { client, rooms, mics } = make();
  await client.applySessions([S('public', 'R-public-g1', true)]);
  await client.applySessions([]);
  assert.equal(rooms[0]!.disconnected, 1);
  assert.equal(mics[0]!.stopped, true);
  assert.deepEqual(client.getSnapshot().channels, {});
});

test('mic denied: channel still connects (listen-only), state is denied, no retry per channel', async () => {
  let asks = 0;
  const { client, rooms } = make(async () => {
    asks++;
    const e = new Error('Permission denied');
    (e as { name: string }).name = 'NotAllowedError';
    throw e;
  });
  await client.applySessions([S('public', 'R-public-g1', true), S('ghosts', 'R-ghosts-g1', true)]);
  const snap = client.getSnapshot();
  assert.equal(snap.mic, 'denied');
  assert.match(snap.micError ?? '', /denied/);
  assert.equal(snap.channels.public?.state, 'connected');
  assert.equal(rooms[0]!.published.length, 0);
  assert.equal(asks, 1);
});

test('mic hardware failure is reported as failed, not denied', async () => {
  const { client } = make(async () => {
    throw new Error('Could not start audio source');
  });
  await client.applySessions([S('public', 'R-public-g1', true)]);
  assert.equal(client.getSnapshot().mic, 'failed');
});

test('connect failure is recorded on the channel and reported', async () => {
  const errors: string[] = [];
  const rooms: FakeRoom[] = [];
  const client = new VoiceClient({
    createRoom: () => {
      const r = new FakeRoom();
      r.failConnect = 'invalid token';
      rooms.push(r);
      return r;
    },
    createMicTrack: async () => new FakeMic(),
    audioContainer: null,
    document: null,
    onError: (ch, err) => errors.push(`${ch}:${(err as Error).message}`),
  });
  await client.applySessions([S('public', 'R-public-g1', true)]);
  assert.equal(client.getSnapshot().channels.public?.state, 'failed');
  assert.deepEqual(errors, ['public:invalid token']);
});

test('participants and speaking follow room events; audioBlocked and unlockAudio', async () => {
  const { client, rooms } = make();
  const changes: number[] = [];
  client.subscribe(() => changes.push(1));
  await client.applySessions([S('public', 'R-public-g1', true)]);
  const room = rooms[0]!;
  room.remoteParticipants.set('p2', { identity: 'p2', isSpeaking: false });
  room.remoteParticipants.set('p1', { identity: 'p1', isSpeaking: false });
  room.emit(EV.participantConnected);
  assert.deepEqual(client.getSnapshot().channels.public?.participants.map((p) => p.identity), ['p1', 'p2']);
  room.activeSpeakers = [{ identity: 'p2' }];
  room.emit(EV.activeSpeakersChanged);
  assert.deepEqual(client.getSnapshot().channels.public?.participants.find((p) => p.identity === 'p2')?.speaking, true);
  room.canPlaybackAudio = false;
  room.emit(EV.audioPlaybackChanged);
  assert.equal(client.getSnapshot().audioBlocked, true);
  await client.unlockAudio();
  assert.equal(room.startAudioCalls, 1);
  assert.equal(client.getSnapshot().audioBlocked, false);
  assert.ok(changes.length > 3);
});

test('setMuted mutes every published mic and is applied to mics acquired later', async () => {
  const { client, mics } = make();
  await client.applySessions([S('public', 'R-public-g1', true)]);
  await client.setMuted(true);
  assert.equal(mics[0]!.muted, true);
  await client.applySessions([S('public', 'R-public-g1', true), S('wolves', 'R-wolves-g1', true)]);
  assert.equal(mics[1]!.muted, true);
  assert.equal(client.getSnapshot().muted, true);
  await client.setMuted(false);
  assert.deepEqual(mics.map((m) => m.muted), [false, false]);
});

test('an ended capture track is re-acquired when the page becomes visible again', async () => {
  const { client, mics, rooms } = make();
  await client.applySessions([S('public', 'R-public-g1', true)]);
  mics[0]!.mediaStreamTrack.readyState = 'ended';
  await client.reacquireMicIfNeeded();
  assert.equal(rooms[0]!.unpublished.length, 1);
  assert.equal(mics.length, 2);
  assert.equal(client.getSnapshot().channels.public?.publishing, true);
});

test('disconnected room is reconnected on the next applySessions when a fresh token arrives', async () => {
  const { client, rooms } = make();
  await client.applySessions([S('public', 'R-public-g1', true)]);
  rooms[0]!.emit(EV.disconnected, 'ROOM_DELETED');
  assert.equal(client.getSnapshot().channels.public?.state, 'disconnected');
  await client.applySessions([S('public', 'R-public-g1', true, true, true, 'fresh')]);
  assert.equal(rooms.length, 2);
  assert.equal(rooms[1]!.connected?.token, 'fresh');
});

test('ADR 0004 session shape (no room/visible) is accepted: room read from the token, visible = speak', async () => {
  const payload = Buffer.from(JSON.stringify({ video: { room: 'ABC-public-g3', roomJoin: true }, sub: 'p1' })).toString('base64url');
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
  assert.equal(roomFromToken(token), 'ABC-public-g3');
  assert.equal(roomFromToken('garbage'), '');
  const n = normalizeSession({ channel: 'public', url: 'wss://x', token, listen: true, speak: false });
  assert.equal(n.room, 'ABC-public-g3');
  assert.equal(n.visible, false);
  const { client, rooms } = make();
  await client.applySessions([{ channel: 'public', url: 'wss://x', token, listen: true, speak: false }]);
  assert.equal(client.getSnapshot().channels.public?.room, 'ABC-public-g3');
  assert.equal(rooms[0]!.published.length, 0);
});

test('dispose disconnects everything and stops mics', async () => {
  const { client, rooms, mics } = make();
  await client.applySessions([S('public', 'R-public-g1', true), S('ghosts', 'R-ghosts-g1', true)]);
  await client.dispose();
  assert.deepEqual(rooms.map((r) => r.disconnected), [1, 1]);
  assert.ok(mics.every((m) => m.stopped));
  assert.deepEqual(client.getSnapshot().channels, {});
});

test('EV names match livekit-client RoomEvent values (skipped if the lib cannot load in Node)', async () => {
  let lib: typeof import('livekit-client') | null = null;
  try {
    lib = await import('livekit-client');
  } catch {
    return; // browser-only module in this Node build; the e2e suite covers it in a real browser
  }
  const RE = lib.RoomEvent;
  assert.equal(EV.participantConnected, RE.ParticipantConnected);
  assert.equal(EV.participantDisconnected, RE.ParticipantDisconnected);
  assert.equal(EV.trackSubscribed, RE.TrackSubscribed);
  assert.equal(EV.trackUnsubscribed, RE.TrackUnsubscribed);
  assert.equal(EV.activeSpeakersChanged, RE.ActiveSpeakersChanged);
  assert.equal(EV.audioPlaybackChanged, RE.AudioPlaybackStatusChanged);
  assert.equal(EV.disconnected, RE.Disconnected);
  assert.equal(EV.reconnecting, RE.Reconnecting);
  assert.equal(EV.reconnected, RE.Reconnected);
  assert.equal(EV.participantPermissionsChanged, RE.ParticipantPermissionsChanged);
});
