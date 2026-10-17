// UI P15: ClientState.lastCloseCode from the real web client (apps/web/src/client.ts) against a real server, in Node
// (global WebSocket; browser globals stubbed). 1012 restart close sets it, failed retries keep it, resume clears it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { createMoonveilServer } from '../src/server.ts';
import { memoryRoomStore } from '../src/store.ts';
import { listenFree } from './ports.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  location: { protocol: 'http:', host: 'x', hostname: 'x', pathname: '/', origin: 'http://x' },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  history: { replaceState: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible' },
  addEventListener: () => {},
});
// Non-literal specifier: the server's tsconfig has no DOM lib, so it must not typecheck client.ts (the web build does).
interface WebClient {
  getState(): { status: string; code: string | null; lastCloseCode: number | null };
  create(mode: 'automatic', profile: { name: string; appearance: { color: string; hat: string } }): void;
  leave(): void;
}
const clientModule = '../../web/src/client.ts';
const { Client } = (await import(clientModule)) as { Client: new (url: string) => WebClient };

const until = async (f: () => boolean, what: string) => {
  for (let i = 0; i < 400 && !f(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(f(), what);
};

test('lastCloseCode: 1012 on restart close, kept through failed retries, cleared on resume; a crash-like drop is not 1012', async () => {
  const rooms = memoryRoomStore();
  const engine = () => createFixtureEngine() as RulesEngine<unknown>;
  const a = createMoonveilServer({ engine, store: rooms });
  const port = await listenFree(a.http);
  const c = new Client(`ws://127.0.0.1:${port}/ws`);
  c.create('automatic', { name: 'Ann', appearance: { color: 'moss', hat: 'none' } });
  await until(() => c.getState().status === 'open', 'created');
  assert.equal(c.getState().lastCloseCode, null);
  const code = c.getState().code!;

  await a.stop();
  await until(() => c.getState().status === 'reconnecting', 'reconnecting after stop');
  assert.equal(c.getState().lastCloseCode, 1012);
  await new Promise((r) => setTimeout(r, 1200)); // several refused retries (server down)
  assert.equal(c.getState().status, 'reconnecting');
  assert.equal(c.getState().lastCloseCode, 1012, 'failed attempts must not overwrite the restart code');

  const b = createMoonveilServer({ engine, store: rooms });
  const sockets = new Set<import('node:net').Socket>();
  b.http.on('connection', (s) => (sockets.add(s), s.on('close', () => sockets.delete(s))));
  b.registry.restoreAll();
  await new Promise<void>((r) => b.http.listen(port, '127.0.0.1', () => r()));
  try {
    await until(() => c.getState().status === 'open', 'resumed on the restarted server');
    assert.equal(c.getState().code, code);
    assert.equal(c.getState().lastCloseCode, null, 'cleared by the welcome');

    // A crash-like drop (TCP reset, no close frame): 1006, so the UI shows neutral copy.
    for (const s of sockets) s.destroy();
    await until(() => c.getState().status === 'reconnecting', 'reconnecting after an abrupt drop');
    assert.equal(c.getState().lastCloseCode, 1006);
    await until(() => c.getState().status === 'open', 'back after the drop');
    assert.equal(c.getState().lastCloseCode, null);
  } finally {
    c.leave();
    await until(() => c.getState().status === 'ended', 'left');
    await b.stop();
  }
});
