import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { WebSocket as WsClient } from 'ws';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { createMoonveilServer } from '../src/server.ts';

const PORT = 4120;
const base = `http://127.0.0.1:${PORT}`;
let srv: ReturnType<typeof createMoonveilServer>;

before(async () => {
  // tmpdir() is redirected into the repo by scripts/env.mjs.
  const dir = mkdtempSync(join(tmpdir(), 'mv-static-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html>INDEX');
  writeFileSync(join(dir, 'assets', 'a.js'), 'x');
  srv = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown>, staticDir: dir, heartbeatMs: 200 });
  await new Promise<void>((r) => srv.http.listen(PORT, '127.0.0.1', r));
});
after(() => srv.stop());

test('static: assets, SPA fallback, traversal, missing asset', async () => {
  assert.equal(await (await fetch(`${base}/assets/a.js`)).text(), 'x');
  assert.match(await (await fetch(`${base}/r/ABCDEF`)).text(), /INDEX/);
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
  assert.notEqual((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status, 200);
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
});

function open(headers: Record<string, string> = {}) {
  const ws = new WsClient(`ws://127.0.0.1:${PORT}/ws`, { headers });
  const msgs: { t: string; [k: string]: unknown }[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  return { ws, msgs };
}
const until = async (f: () => boolean) => {
  for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(f());
};

test('ws: cross-origin upgrade rejected, same-origin accepted', async () => {
  const bad = open({ origin: 'http://evil.example' });
  const err = await new Promise<Error>((r) => bad.ws.on('error', r));
  assert.match(err.message, /403/);
  const good = open({ origin: base });
  await new Promise((r) => good.ws.on('open', r));
  good.ws.close();
});

test('ws: malformed frames get bad-message; create works; app heartbeat arrives', async () => {
  const c = open();
  await new Promise((r) => c.ws.on('open', r));
  c.ws.send('not json');
  c.ws.send(JSON.stringify({ t: 'create', mode: 'automatic', profile: { name: '', appearance: { color: 'moss', hat: 'none' } } }));
  c.ws.send(JSON.stringify({ t: 'start' }));
  await until(() => c.msgs.length >= 3);
  assert.deepEqual(c.msgs.slice(0, 2).map((m) => m.code), ['bad-message', 'bad-message']);
  assert.equal(c.msgs[2]!.code, 'not-joined');
  c.ws.send(JSON.stringify({ t: 'create', mode: 'automatic', profile: { name: 'Ann', appearance: { color: 'moss', hat: 'none' } } }));
  await until(() => c.msgs.some((m) => m.t === 'state'));
  await until(() => c.msgs.some((m) => m.t === 'hb'));
  c.ws.close();
});

test('ws: idle room swept by heartbeat loop; resume then fails with room-not-found', async () => {
  const idle = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown>, heartbeatMs: 100, idleMs: 150 });
  await new Promise<void>((r) => idle.http.listen(PORT + 1, '127.0.0.1', r));
  try {
    const url = `ws://127.0.0.1:${PORT + 1}/ws`;
    const a = new WsClient(url);
    const got: { t: string; [k: string]: unknown }[] = [];
    a.on('message', (d) => got.push(JSON.parse(String(d))));
    await new Promise((r) => a.on('open', r));
    a.send(JSON.stringify({ t: 'create', mode: 'automatic', profile: { name: 'Ann', appearance: { color: 'moss', hat: 'none' } } }));
    await until(() => got.some((m) => m.t === 'welcome'));
    const w = got.find((m) => m.t === 'welcome')!;
    a.close();
    await until(() => idle.registry.size === 0);
    const b = new WsClient(url);
    const got2: { t: string; [k: string]: unknown }[] = [];
    b.on('message', (d) => got2.push(JSON.parse(String(d))));
    await new Promise((r) => b.on('open', r));
    b.send(JSON.stringify({ t: 'resume', code: w.code, token: w.token }));
    await until(() => got2.length > 0);
    assert.equal(got2[0]!.code, 'room-not-found');
    b.close();
  } finally {
    await idle.stop();
  }
});

test('ws + REAL engine: 7 sockets, start, wolf chat only to wolves, illegal move dropped', async () => {
  const { createRulesEngine } = await import('@moonveil/rules');
  const srv2 = createMoonveilServer({ engine: () => createRulesEngine() as RulesEngine<unknown>, heartbeatMs: 60_000 });
  await new Promise<void>((r) => srv2.http.listen(PORT + 2, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${PORT + 2}/ws`;
  const app = { color: 'moss', hat: 'none' };
  type M = { t: string; [k: string]: unknown };
  const clients: { ws: WsClient; msgs: M[] }[] = [];
  const connect = async () => {
    const ws = new WsClient(url);
    const c = { ws, msgs: [] as M[] };
    ws.on('message', (d) => c.msgs.push(JSON.parse(String(d))));
    await new Promise((r) => ws.on('open', r));
    clients.push(c);
    return c;
  };
  try {
    const host = await connect();
    host.ws.send(JSON.stringify({ t: 'create', mode: 'automatic', profile: { name: 'P0', appearance: app } }));
    await until(() => host.msgs.some((m) => m.t === 'welcome'));
    const code = host.msgs.find((m) => m.t === 'welcome')!.code;
    for (let i = 1; i < 7; i++) {
      const c = await connect();
      c.ws.send(JSON.stringify({ t: 'join', code, profile: { name: `P${i}`, appearance: app } }));
    }
    await until(() => clients.every((c) => c.msgs.some((m) => m.t === 'welcome')));
    for (const c of clients) c.ws.send(JSON.stringify({ t: 'ready', ready: true }));
    const lastView = (c: { msgs: M[] }) => (c.msgs.filter((m) => m.t === 'state').at(-1) as unknown as { view: { canStart: boolean; status: string; game: { me: { role: string } } } }).view;
    await until(() => lastView(host).canStart);
    host.ws.send(JSON.stringify({ t: 'start' }));
    await until(() => clients.every((c) => lastView(c).status === 'playing'));
    const wolves = clients.filter((c) => lastView(c).game.me.role === 'wolf');
    const others = clients.filter((c) => !wolves.includes(c));
    const before = others.map((o) => o.msgs.length);
    others[0]!.ws.send(JSON.stringify({ t: 'move', x: 0.5, y: 0.5, facing: 0, moving: true })); // living during play: dropped
    wolves[0]!.ws.send(JSON.stringify({ t: 'say', ref: 'w', channel: 'wolves', text: 'over the wire' }));
    await until(() => wolves.every((w) => w.msgs.some((m) => m.t === 'chat')));
    await new Promise((r) => setTimeout(r, 100));
    others.forEach((o, i) => assert.equal(o.msgs.length, before[i], 'non-wolf got a frame'));
    assert.ok(!clients.some((c) => c.msgs.some((m) => m.t === 'poses')), 'living move produced poses');
  } finally {
    for (const c of clients) c.ws.close();
    await srv2.stop();
  }
});
