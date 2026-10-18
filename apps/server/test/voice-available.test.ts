// P19: SeatView.voiceAvailable = a voice backend is configured. False without one (nullVoiceGateway), true with one,
// for every seat kind, in both room voice modes (independent of voiceMode), and from the real entry with and
// without LIVEKIT_*.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { test } from 'node:test';
import { Registry } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { recordingVoiceGateway } from '../src/voice.ts';
import { FakeClient, ManualClock, profile } from './harness.ts';
import WebSocket from 'ws';

function lobby(voice: boolean, mode: 'automatic' | 'moderator', voiceMode: 'remote' | 'inPerson') {
  const clock = new ManualClock();
  const reg = new Registry({ engine: () => createFixtureEngine() as RulesEngine<unknown>, scheduler: clock, now: clock.now, ...(voice ? { voice: recordingVoiceGateway().gateway } : {}) });
  const host = new FakeClient(reg);
  host.send({ t: 'create', mode, profile: profile('Host'), voiceMode });
  const p = new FakeClient(reg);
  p.send({ t: 'join', code: host.code!, profile: profile('Pat') });
  return [host, p];
}

test('voiceAvailable: false without a voice backend, true with one; every seat kind; independent of voiceMode', () => {
  for (const mode of ['automatic', 'moderator'] as const) {
    for (const voiceMode of ['remote', 'inPerson'] as const) {
      for (const c of lobby(false, mode, voiceMode)) assert.equal(c.view.voiceAvailable, false, `${mode}/${voiceMode} without backend`);
      for (const c of lobby(true, mode, voiceMode)) assert.equal(c.view.voiceAvailable, true, `${mode}/${voiceMode} with backend`);
    }
  }
});

async function entryView(env: Record<string, string>) {
  const port = await new Promise<number>((r) => {
    const n = createServer().listen(0, '127.0.0.1', () => {
      const p = (n.address() as { port: number }).port;
      n.close(() => r(p));
    });
  });
  const p = spawn(process.execPath, ['apps/server/src/main.ts'], {
    cwd: join(import.meta.dirname, '../../..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'fixture', MOONVEIL_PERSIST: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  try {
    await new Promise<void>((r, j) => {
      p.stdout.on('data', () => out.includes('moonveil server') && r());
      p.once('exit', (c) => j(new Error(`exited ${c}: ${out}`)));
    });
    return await new Promise<boolean>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'create', mode: 'automatic', profile: { name: 'Ann', appearance: { color: 'moss', hat: 'none' } } })));
      ws.on('message', (d) => {
        const m = JSON.parse(String(d));
        if (m.t === 'state') {
          ws.close();
          resolve(m.view.voiceAvailable);
        }
      });
      ws.on('error', reject);
    });
  } finally {
    p.kill('SIGKILL');
  }
}

test('real entry: voiceAvailable follows the LIVEKIT_* configuration', async () => {
  const none = Object.fromEntries(['LIVEKIT_URL', 'LIVEKIT_PUBLIC_WS', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].map((k) => [k, '']));
  assert.equal(await entryView(none), false);
  assert.equal(
    await entryView({ LIVEKIT_URL: 'https://p.livekit.cloud', LIVEKIT_PUBLIC_WS: 'wss://p.livekit.cloud', LIVEKIT_API_KEY: 'APIkey123', LIVEKIT_API_SECRET: 'secret-for-tests-only-0123456789abcdef' }),
    true,
  );
});
