// Moonveil voice spike: stand-in for the game server's voice responsibilities.
// Holds a tiny game state, derives per-player channel entitlements, mints LiveKit
// tokens, and enforces changes through the LiveKit server API. Port 4302.
// Not production code; the real server (Foundation scope) owns state + protocol.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.VOICE_SPIKE_PORT || 4302);
const LK_HTTP = process.env.LIVEKIT_HTTP || 'http://127.0.0.1:4300';
const LK_WS = process.env.LIVEKIT_WS || 'ws://127.0.0.1:4300';
const LK_KEY = process.env.LIVEKIT_API_KEY || 'moonveil-dev';
const LK_SECRET = process.env.LIVEKIT_API_SECRET || 'moonveil-dev-secret-not-for-production-0000000000';
const TOKEN_TTL_S = 15 * 60;

const svc = new RoomServiceClient(LK_HTTP, LK_KEY, LK_SECRET);

// ---- game state (spike only) ----
const state = {
  match: 'm1',
  mode: 'remote', // 'remote' | 'in-person'
  phase: 'lobby', // 'lobby' | 'day' | 'night'
  epoch: 0,
  // Room generation per channel. OSS LiveKit does not revoke already-issued tokens on
  // RemoveParticipant (RevokeTokenTs is ignored by the OSS server, verified in source + test),
  // so whenever anyone is removed from a channel we rotate it: new room name, new tokens,
  // old room deleted. auto_create is off, so a stale token for the old room cannot join.
  gen: { public: 1, wolves: 1, ghosts: 1 },
  players: new Map(), // id -> { id, role: 'wolf'|'villager', alive: true }
};
const roomName = (channel) => `${state.match}-${channel}-g${state.gen[channel]}`;
const CHANNELS = ['public', 'wolves', 'ghosts'];

// Channel rules -> entitlements. This is the function Foundation's server must own.
function entitlements(p) {
  if (state.mode === 'in-person') return [];
  const out = [];
  if (state.phase === 'lobby') {
    out.push({ channel: 'public', canPublish: true, canSubscribe: true, hidden: false });
    return out;
  }
  if (p.alive) {
    // Living: public is speak+hear by day, hear-only by night (uniform for every role).
    out.push({ channel: 'public', canPublish: state.phase === 'day', canSubscribe: true, hidden: false });
    // Wolves stay connected to the wolf channel for the whole match; only publish at night.
    if (p.role === 'wolf') out.push({ channel: 'wolves', canPublish: state.phase === 'night', canSubscribe: true, hidden: false });
  } else {
    // Ghosts: hear public invisibly, talk among ghosts. Never the wolf channel.
    out.push({ channel: 'public', canPublish: false, canSubscribe: true, hidden: true });
    out.push({ channel: 'ghosts', canPublish: true, canSubscribe: true, hidden: false });
  }
  return out;
}

async function mintToken(p, e) {
  const at = new AccessToken(LK_KEY, LK_SECRET, { identity: p.id, name: p.id, ttl: TOKEN_TTL_S });
  at.addGrant({
    room: roomName(e.channel),
    roomJoin: true,
    canPublish: e.canPublish,
    canSubscribe: e.canSubscribe,
    canPublishData: e.canPublish,
    hidden: e.hidden,
    canUpdateOwnMetadata: false,
  });
  return at.toJwt();
}

async function entitlementPayload(p) {
  const ents = entitlements(p);
  const list = [];
  for (const e of ents) list.push({ ...e, room: roomName(e.channel), url: LK_WS, token: await mintToken(p, e) });
  return { epoch: state.epoch, phase: state.phase, mode: state.mode, alive: p.alive, role: p.role, entitlements: list };
}

// ---- enforcement against LiveKit (server API) ----
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function listRoomParticipants(room) {
  try { return await svc.listParticipants(room); } catch { return []; }
}

// Reconcile every LiveKit room with the entitlements. Removals + permission updates run in
// parallel in shuffled order so observable timing does not correlate with role.
async function enforce() {
  const ops = [];
  const rotated = [];
  for (const ch of CHANNELS) {
    const room = roomName(ch);
    const present = await listRoomParticipants(room);
    const mustRemove = present.some((pi) => {
      const p = state.players.get(pi.identity);
      const e = p ? entitlements(p).find((x) => x.channel === ch) : undefined;
      return !e || e.hidden !== !!pi.permission?.hidden;
    });
    if (mustRemove) {
      // Rotate the channel: everyone in it is disconnected at once (uniform), stale tokens die with the room.
      ops.push(() => svc.deleteRoom(room).catch((err) => console.error('deleteRoom failed', room, err.message)));
      state.gen[ch] += 1;
      rotated.push(ch);
      continue;
    }
    for (const pi of present) {
      const p = state.players.get(pi.identity);
      const e = entitlements(p).find((x) => x.channel === ch);
      {
        const cur = pi.permission || {};
        if (!!cur.canPublish !== e.canPublish || !!cur.canSubscribe !== e.canSubscribe) {
          ops.push(() => svc.updateParticipant(room, pi.identity, {
            permission: { canPublish: e.canPublish, canSubscribe: e.canSubscribe, canPublishData: e.canPublish, hidden: e.hidden, canPublishSources: [] },
          }).catch((err) => console.error('updateParticipant failed', room, pi.identity, err.message)));
        }
      }
    }
  }
  await Promise.all(shuffle(ops).map((f) => f()));
  // Rooms are created explicitly (auto_create: false) so only names the server chose can be joined.
  for (const ch of CHANNELS) await svc.createRoom({ name: roomName(ch), emptyTimeout: 600 }).catch(() => {});
  return rotated;
}

// ---- SSE push of entitlements to clients ----
const sseClients = new Map(); // playerId -> Set<res>
async function pushAll() {
  for (const [id, set] of sseClients) {
    const p = state.players.get(id);
    if (!p) continue;
    const payload = JSON.stringify(await entitlementPayload(p));
    for (const res of set) res.write(`event: entitlements\ndata: ${payload}\n\n`);
  }
}

async function transition(mutate) {
  mutate();
  state.epoch += 1;
  // Enforce first (so a client ignoring SSE is still cut off), then tell clients.
  const rotated = await enforce();
  if (rotated.length) console.log('rotated channels', rotated.join(','), '-> gen', JSON.stringify(state.gen));
  await pushAll();
}

// ---- HTTP ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.map': 'application/json', '.css': 'text/css' };
const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => resolve(b ? JSON.parse(b) : {})); });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/state') return json(res, 200, { ...state, players: [...state.players.values()], rooms: Object.fromEntries(CHANNELS.map((c) => [c, roomName(c)])) });
    if (url.pathname === '/api/setup' && req.method === 'POST') {
      const body = await readBody(req);
      await transition(() => {
        state.match = body.match || `m${Date.now().toString(36)}`;
        state.mode = 'remote'; state.phase = 'lobby'; state.players.clear(); state.gen = { public: 1, wolves: 1, ghosts: 1 };
        for (const p of body.players) state.players.set(p.id, { id: p.id, role: p.role, alive: true });
      });
      return json(res, 200, { ok: true, epoch: state.epoch, match: state.match });
    }
    if (url.pathname === '/api/phase' && req.method === 'POST') {
      const { phase } = await readBody(req);
      if (!['lobby', 'day', 'night'].includes(phase)) return json(res, 400, { error: 'bad phase' });
      await transition(() => { state.phase = phase; });
      return json(res, 200, { ok: true, epoch: state.epoch });
    }
    if (url.pathname === '/api/mode' && req.method === 'POST') {
      const { mode } = await readBody(req);
      if (!['remote', 'in-person'].includes(mode)) return json(res, 400, { error: 'bad mode' });
      await transition(() => { state.mode = mode; });
      return json(res, 200, { ok: true, epoch: state.epoch });
    }
    if (url.pathname === '/api/kill' && req.method === 'POST') {
      const { id } = await readBody(req);
      const p = state.players.get(id);
      if (!p) return json(res, 404, { error: 'no player' });
      await transition(() => { p.alive = false; });
      return json(res, 200, { ok: true, epoch: state.epoch });
    }
    if (url.pathname === '/api/entitlements') {
      const p = state.players.get(url.searchParams.get('player'));
      if (!p) return json(res, 404, { error: 'no player' });
      return json(res, 200, await entitlementPayload(p));
    }
    if (url.pathname === '/api/rooms') {
      // Test-only inspection: what LiveKit itself reports per room.
      const out = {};
      for (const ch of CHANNELS) out[ch] = (await listRoomParticipants(roomName(ch))).map((pi) => ({ identity: pi.identity, hidden: !!pi.permission?.hidden, canPublish: !!pi.permission?.canPublish, tracks: pi.tracks.length }));
      return json(res, 200, out);
    }
    if (url.pathname === '/api/events') {
      const id = url.searchParams.get('player');
      const p = state.players.get(id);
      if (!p) return json(res, 404, { error: 'no player' });
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      if (!sseClients.has(id)) sseClients.set(id, new Set());
      sseClients.get(id).add(res);
      req.on('close', () => sseClients.get(id)?.delete(res));
      res.write(`event: entitlements\ndata: ${JSON.stringify(await entitlementPayload(p))}\n\n`);
      return;
    }
    // static
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    let abs;
    if (file.startsWith('/vendor/')) abs = path.join(__dirname, 'node_modules/livekit-client/dist', file.slice('/vendor/'.length));
    else abs = path.join(__dirname, 'web', file);
    if (!abs.startsWith(__dirname) || !fs.existsSync(abs)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(abs)] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: String(err?.message || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`voice spike server http://127.0.0.1:${PORT} -> livekit ${LK_HTTP}`));
