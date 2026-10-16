// Spike client. One LiveKit Room per entitled channel. Exposes observation + attack hooks
// on window.__voice for the Playwright test. Everything here is untrusted from the game's
// point of view; the proof is that the server limits what this code can achieve.
import { Room, RoomEvent, Track, createLocalAudioTrack } from '/vendor/livekit-client.esm.mjs';

const params = new URLSearchParams(location.search);
const playerId = params.get('player');
document.getElementById('who').textContent = playerId;

const V = (window.__voice = {
  player: playerId,
  ready: false,
  epoch: -1,
  phase: null,
  mode: null,
  channels: {}, // channel -> { room, perm, state, localPublished, publishError, analysers }
  log: [], // { t, ch, ev, identity, trackSid, extra }
  micError: null,
});

const logEl = document.getElementById('log');
function log(ch, ev, identity, trackSid, extra) {
  const e = { t: performance.now(), ch, ev, identity, trackSid, extra };
  V.log.push(e);
  if (logEl.childNodes.length < 400) logEl.textContent += `${e.t.toFixed(0)} ${ch} ${ev} ${identity ?? ''} ${trackSid ?? ''}\n`;
}

let audioCtx;
function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function attachAnalyser(chan, track, identity) {
  try {
    const ctx = ensureAudioCtx();
    const src = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    chan.analysers[track.sid] = { an, identity, buf: new Float32Array(an.fftSize) };
  } catch (err) {
    log(chan.name, 'analyserError', identity, track.sid, String(err));
  }
}

function rmsOf(a) {
  a.an.getFloatTimeDomainData(a.buf);
  let s = 0;
  for (let i = 0; i < a.buf.length; i++) s += a.buf[i] * a.buf[i];
  return Math.sqrt(s / a.buf.length);
}

async function publishMic(chan) {
  try {
    const track = await createLocalAudioTrack({ echoCancellation: false, noiseSuppression: false, autoGainControl: false });
    await chan.room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, dtx: false, red: false });
    chan.localPublished = true;
    log(chan.name, 'localPublished', playerId, track.sid);
  } catch (err) {
    chan.publishError = String(err?.message || err);
    if (/NotAllowed|Permission|denied/i.test(chan.publishError)) V.micError = chan.publishError;
    log(chan.name, 'publishError', playerId, null, chan.publishError);
  }
}

function wireRoom(chan) {
  const { room, name } = chan;
  const ev = (e) => room.on(e, (...args) => {
    const [a, b] = args;
    const pub = a && a.trackSid ? a : undefined;
    const part = b && b.identity ? b : (a && a.identity ? a : undefined);
    log(name, e, part?.identity, pub?.trackSid, e === RoomEvent.ActiveSpeakersChanged ? a.map((p) => p.identity) : undefined);
  });
  for (const e of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
    RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ActiveSpeakersChanged,
    RoomEvent.ParticipantPermissionsChanged, RoomEvent.TrackSubscriptionFailed, RoomEvent.TrackSubscriptionPermissionChanged,
    RoomEvent.Disconnected, RoomEvent.Reconnecting, RoomEvent.Reconnected, RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantAttributesChanged]) ev(e);

  room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
    if (track.kind !== Track.Kind.Audio) return;
    const el = track.attach();
    el.dataset.ch = name; el.dataset.identity = participant.identity;
    document.body.appendChild(el);
    attachAnalyser(chan, track, participant.identity);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach().forEach((el) => el.remove());
    delete chan.analysers[track.sid];
  });
  room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    const btn = document.getElementById('unlock');
    btn.hidden = room.canPlaybackAudio;
    btn.onclick = () => Promise.all(Object.values(V.channels).map((c) => c.room.startAudio())).then(() => { btn.hidden = true; });
  });
  room.on(RoomEvent.Disconnected, (reason) => { chan.state = 'disconnected'; chan.disconnectReason = String(reason); });
  room.on(RoomEvent.Reconnected, () => { chan.state = 'connected'; });
}

async function connectChannel(e) {
  const room = new Room({ adaptiveStream: false, dynacast: false });
  const chan = { name: e.channel, roomName: e.room, room, perm: e, state: 'connecting', localPublished: false, publishError: null, analysers: {}, token: e.token };
  V.channels[e.channel] = chan;
  wireRoom(chan);
  try {
    await room.connect(e.url, e.token, { autoSubscribe: true });
    chan.state = 'connected';
    log(e.channel, 'connected', playerId, null, room.name);
    // Subscribe to tracks already present.
    for (const p of room.remoteParticipants.values()) for (const pub of p.trackPublications.values()) if (pub.track) { attachAnalyser(chan, pub.track, p.identity); }
    if (e.canPublish) await publishMic(chan);
  } catch (err) {
    chan.state = 'failed';
    chan.connectError = String(err?.message || err);
    log(e.channel, 'connectError', playerId, null, chan.connectError);
  }
}

async function reconcile(payload) {
  V.epoch = payload.epoch; V.phase = payload.phase; V.mode = payload.mode; V.alive = payload.alive;
  const wanted = new Map(payload.entitlements.map((e) => [e.channel, e]));
  // Drop channels no longer entitled (server already removed us; this is cleanup).
  for (const [name, chan] of Object.entries(V.channels)) {
    const e = wanted.get(name);
    if (!e || e.hidden !== chan.perm.hidden || e.room !== chan.roomName) { await chan.room.disconnect(); delete V.channels[name]; }
  }
  for (const e of wanted.values()) {
    const chan = V.channels[e.channel];
    if (!chan) { await connectChannel(e); continue; }
    chan.perm = e; chan.token = e.token;
    if (chan.state === 'disconnected' || chan.state === 'failed') { delete V.channels[e.channel]; await connectChannel(e); continue; }
    // Permission flips: publish/unpublish mic to follow the grant. Server enforces regardless.
    if (e.canPublish && !chan.localPublished) await publishMic(chan);
    if (!e.canPublish && chan.localPublished) {
      for (const pub of chan.room.localParticipant.trackPublications.values()) if (pub.track) await chan.room.localParticipant.unpublishTrack(pub.track, true);
      chan.localPublished = false;
    }
  }
  render();
}

function render() {
  document.getElementById('status').textContent = `epoch ${V.epoch} · ${V.mode} · ${V.phase} · ${V.alive === false ? 'ghost' : 'alive'}`;
  const el = document.getElementById('channels');
  el.innerHTML = '';
  for (const chan of Object.values(V.channels)) {
    const d = document.createElement('div'); d.className = 'ch';
    d.innerHTML = `<b>${chan.name}</b> (${chan.roomName}) ${chan.state} · pub=${chan.perm.canPublish} sub=${chan.perm.canSubscribe} hidden=${chan.perm.hidden}<br/>` +
      [...chan.room.remoteParticipants.values()].map((p) => `<span class="${p.isSpeaking ? 'speaking' : ''}">${p.identity}</span>`).join(', ');
    el.appendChild(d);
  }
}
setInterval(render, 1000);

// ---- observation API for tests ----
V.snapshot = async function snapshot() {
  const out = { player: playerId, epoch: V.epoch, phase: V.phase, mode: V.mode, alive: V.alive, micError: V.micError, channels: {} };
  for (const chan of Object.values(V.channels)) {
    const c = { roomName: chan.roomName, state: chan.state, perm: { canPublish: chan.perm.canPublish, canSubscribe: chan.perm.canSubscribe, hidden: chan.perm.hidden },
      localPublished: chan.localPublished, publishError: chan.publishError, canPlaybackAudio: chan.room.canPlaybackAudio,
      localPermissions: chan.room.localParticipant.permissions ? { canPublish: chan.room.localParticipant.permissions.canPublish, canSubscribe: chan.room.localParticipant.permissions.canSubscribe, hidden: chan.room.localParticipant.permissions.hidden } : null,
      activeSpeakers: chan.room.activeSpeakers.map((p) => p.identity), remote: {} };
    for (const p of chan.room.remoteParticipants.values()) {
      const r = { isSpeaking: p.isSpeaking, audioLevel: p.audioLevel, tracks: [] };
      for (const pub of p.trackPublications.values()) {
        const t = { sid: pub.trackSid, kind: pub.kind, subscribed: pub.isSubscribed, muted: pub.isMuted, energy: null, rms: null };
        if (pub.track && pub.kind === 'audio') {
          const st = await pub.track.getReceiverStats().catch(() => undefined);
          t.energy = st?.totalAudioEnergy ?? null; t.bytes = st?.bytesReceived ?? null;
          const a = chan.analysers[pub.trackSid];
          if (a) t.rms = rmsOf(a);
        }
        r.tracks.push(t);
      }
      c.remote[p.identity] = r;
    }
    out.channels[chan.name] = c;
  }
  return out;
};

// ---- attack API: what a tampered client could try ----
V.attack = {
  // Try to publish even though the grant says no: bypass the SDK's local permission check.
  async forcePublish(channel) {
    const chan = V.channels[channel];
    if (!chan) return { ok: false, error: 'no such channel' };
    try {
      const lp = chan.room.localParticipant;
      if (lp.permissions) { lp.permissions.canPublish = true; lp.permissions.canPublishSources = []; }
      const track = await createLocalAudioTrack();
      const pub = await Promise.race([
        lp.publishTrack(track, { source: Track.Source.Microphone }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('publish timed out (server never accepted)')), 8000)),
      ]);
      return { ok: true, trackSid: pub.trackSid };
    } catch (err) { return { ok: false, error: String(err?.message || err) }; }
  },
  // Try to join a room with an arbitrary token (stale, forged, or someone else's).
  async connectWith(url, token) {
    const room = new Room();
    try {
      await room.connect(url, token);
      const info = { ok: true, roomName: room.name, participants: [...room.remoteParticipants.keys()] };
      await room.disconnect();
      return info;
    } catch (err) { return { ok: false, error: String(err?.message || err) }; }
  },
  // Try to subscribe to everything in a channel (should be a no-op when nothing is allowed).
  async subscribeAll(channel) {
    const chan = V.channels[channel];
    if (!chan) return { ok: false, error: 'no such channel' };
    for (const p of chan.room.remoteParticipants.values()) for (const pub of p.trackPublications.values()) pub.setSubscribed(true);
    return { ok: true };
  },
};

// ---- entitlement stream ----
const es = new EventSource(`/api/events?player=${encodeURIComponent(playerId)}`);
let chain = Promise.resolve();
es.addEventListener('entitlements', (ev) => { chain = chain.then(() => reconcile(JSON.parse(ev.data))).then(() => { V.ready = true; }); });
