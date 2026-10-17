// Best-effort restart notice (ADR 0010 §4): on stop/SIGTERM the server saves every room, closes each socket with 1012,
// and exits; clients then reconnect and resume from the saved room. Crashes/SIGKILL give no notice (robustness e2e).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CLOSE } from '@moonveil/protocol';
import { WebSocket as WsClient } from 'ws';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { createMoonveilServer } from '../src/server.ts';
import { fileRoomStore } from '../src/store.ts';
import { listenFree } from './ports.ts';

type Msg = { t: string; [k: string]: unknown };
const profile = { name: 'Ann', appearance: { color: 'moss', hat: 'none' } };

function client(port: number) {
  const ws = new WsClient(`ws://127.0.0.1:${port}/ws`);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d)) as Msg));
  const closed = new Promise<{ code: number; reason: string }>((r) => ws.on('close', (code, reason) => r({ code, reason: String(reason) })));
  const opened = new Promise((r, j) => (ws.on('open', r), ws.on('error', j)));
  const until = async (f: (m: Msg) => boolean) => {
    for (let i = 0; i < 200; i++) {
      const m = msgs.find(f);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`no matching message in ${JSON.stringify(msgs.map((m) => m.t))}`);
  };
  return { ws, msgs, closed, opened, until };
}
const lastView = (msgs: Msg[]) => (msgs.filter((m) => m.t === 'state').at(-1)!.view as { code: string; players: { name: string; ready: boolean }[] });

test('stop(): rooms saved, sockets closed with 1012, a new server restores the room and the client resumes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mv-shutdown-'));
  const engine = () => createFixtureEngine() as RulesEngine<unknown>;
  const a = createMoonveilServer({ engine, store: fileRoomStore(dir) });
  const c = client(await listenFree(a.http));
  await c.opened;
  c.ws.send(JSON.stringify({ t: 'create', mode: 'automatic', profile }));
  const welcome = await c.until((m) => m.t === 'welcome');
  c.ws.send(JSON.stringify({ t: 'ready', ready: true }));
  await c.until((m) => m.t === 'state' && lastView(c.msgs).players[0]!.ready);
  await a.stop();
  assert.deepEqual(await c.closed, { code: CLOSE.serviceRestart, reason: 'service restart' });
  assert.equal(CLOSE.serviceRestart, 1012);
  const saved = fileRoomStore(dir).loadAll();
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.code, welcome.code);

  const b = createMoonveilServer({ engine, store: fileRoomStore(dir) });
  assert.equal(b.registry.restoreAll().restored, 1);
  const back = client(await listenFree(b.http));
  try {
    await back.opened;
    back.ws.send(JSON.stringify({ t: 'resume', code: welcome.code, token: welcome.token }));
    const again = await back.until((m) => m.t === 'welcome');
    assert.equal(again.seat, welcome.seat, 'same seat');
    await back.until((m) => m.t === 'state');
    assert.equal(lastView(back.msgs).code, welcome.code);
    assert.equal(lastView(back.msgs).players[0]!.ready, true, 'state from before the shutdown');
  } finally {
    back.ws.close();
    await b.stop();
  }
});

test('stop(): new upgrades are refused while stopping; no clients = immediate', async () => {
  const s = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown> });
  const port = await listenFree(s.http);
  const c = client(port);
  await c.opened;
  const stopped = s.stop(500);
  const late = new WsClient(`ws://127.0.0.1:${port}/ws`);
  const err = await new Promise<string>((r) => (late.on('error', (e) => r(e.message)), late.on('open', () => r('open'))));
  assert.notEqual(err, 'open');
  await stopped;
  assert.equal((await c.closed).code, 1012);
  const t0 = Date.now();
  const empty = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown> });
  await listenFree(empty.http);
  await empty.stop();
  assert.ok(Date.now() - t0 < 400, 'no grace wait without clients');
});

const freePort = () =>
  new Promise<number>((resolve) => {
    const n = createServer().listen(0, '127.0.0.1', () => {
      const { port } = n.address() as { port: number };
      n.close(() => resolve(port));
    });
  });

test('process: SIGTERM -> 1012 to clients, exit 0, room on disk; the restarted process restores it and the client resumes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mv-sigterm-'));
  const port = await freePort();
  const start = () => {
    const p = spawn(process.execPath, ['apps/server/src/main.ts'], {
      cwd: join(import.meta.dirname, '../../..'),
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'fixture', MOONVEIL_DATA_DIR: dir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    const ready = new Promise<void>((r, j) => {
      p.stdout.on('data', () => out.includes('moonveil server') && r());
      p.once('exit', (code) => j(new Error(`exited ${code}: ${out}`)));
    });
    return { p, ready, log: () => out };
  };
  const first = start();
  await first.ready;
  const c = client(port);
  await c.opened;
  c.ws.send(JSON.stringify({ t: 'create', mode: 'automatic', profile }));
  const welcome = await c.until((m) => m.t === 'welcome');
  const exited = new Promise<number | null>((r) => first.p.once('exit', (code) => r(code)));
  first.p.kill('SIGTERM');
  assert.equal((await c.closed).code, 1012);
  assert.equal(await exited, 0);
  assert.deepEqual(fileRoomStore(dir).loadAll().map((s) => s.code), [welcome.code]);

  const second = start();
  try {
    await second.ready;
    assert.match(second.log(), /restoredRooms=1/);
    const back = client(port);
    await back.opened;
    back.ws.send(JSON.stringify({ t: 'resume', code: welcome.code, token: welcome.token }));
    assert.equal((await back.until((m) => m.t === 'welcome')).seat, welcome.seat);
    back.ws.close();
  } finally {
    second.p.kill('SIGKILL');
  }
});
