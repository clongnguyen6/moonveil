// ADR 0009 deploy switches: env -> allowed /ws origins, LAN listing, port warning. Unset env = local behaviour.
// Plus the server: an allowed origin passes even when a proxy rewrites Host; others are still refused.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { WebSocket as WsClient } from 'ws';
import { allowedOrigins, lanEnabled, warnPort } from '../src/deploy.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { createMoonveilServer } from '../src/server.ts';
import { listenFree } from './ports.ts';

test('local env: no extra origins, LAN on, port warning outside 4100-4199', () => {
  assert.deepEqual(allowedOrigins({}), []);
  assert.equal(lanEnabled({}), true);
  assert.equal(warnPort({}, 4100), false);
  assert.equal(warnPort({}, 10000), true);
  // RENDER_EXTERNAL_URL alone (not on Render) changes nothing.
  assert.deepEqual(allowedOrigins({ RENDER_EXTERNAL_URL: 'https://x.onrender.com' }), []);
});

test('Render env: external URL allowed, LAN off, no port warning', () => {
  const env = { RENDER: 'true', RENDER_EXTERNAL_URL: 'https://moonveil.onrender.com' };
  assert.deepEqual(allowedOrigins(env), ['https://moonveil.onrender.com']);
  assert.equal(lanEnabled(env), false);
  assert.equal(warnPort(env, 10000), false);
});

test('MOONVEIL_ALLOWED_ORIGINS: trimmed, normalised to origin, deduped; non-http(s) or junk is a startup error', () => {
  assert.deepEqual(
    allowedOrigins({ MOONVEIL_ALLOWED_ORIGINS: ' https://a.example/path , https://a.example,http://b.example:4100 ', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://a.example' }),
    ['https://a.example', 'http://b.example:4100'],
  );
  assert.throws(() => allowedOrigins({ MOONVEIL_ALLOWED_ORIGINS: 'ftp://a.example' }));
  assert.throws(() => allowedOrigins({ MOONVEIL_ALLOWED_ORIGINS: 'not a url' }));
  assert.equal(lanEnabled({ MOONVEIL_LAN: '0' }), false);
});

test('ws: allowed origin passes with a rewritten Host; unlisted origin and same-origin rules unchanged', async () => {
  const srv = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown>, allowedOrigins: ['https://moonveil.onrender.com'] });
  const port = await listenFree(srv.http);
  const open = (origin: string, host: string) =>
    new Promise<string>((resolve) => {
      const ws = new WsClient(`ws://127.0.0.1:${port}/ws`, { headers: { origin, host } });
      ws.on('open', () => (ws.close(), resolve('open')));
      ws.on('error', (e) => resolve(e.message));
    });
  try {
    assert.equal(await open('https://moonveil.onrender.com', 'internal:10000'), 'open');
    assert.match(await open('https://evil.example', 'internal:10000'), /403/);
    assert.match(await open('http://moonveil.onrender.com', 'internal:10000'), /403/, 'scheme is part of the origin');
    assert.equal(await open(`http://internal:10000`, 'internal:10000'), 'open', 'same-origin still accepted');
  } finally {
    await srv.stop();
  }
});

test('deploy/render.yaml draft: no test-only vars, no secret values, one free instance', () => {
  const y = readFileSync(join(import.meta.dirname, '../../../deploy/render.yaml'), 'utf8');
  const entries = [...y.matchAll(/- key: (\S+)\n\s+(value|sync): (.+)/g)].map((m) => ({ key: m[1]!, kind: m[2]!, v: m[3]! }));
  assert.ok(entries.length >= 8, 'parsed the envVars');
  for (const e of entries) {
    assert.doesNotMatch(e.key, /^(MOONVEIL_TEST_|MOONVEIL_FIXTURE_|E2E_)/, `test-only var ${e.key}`);
    if (e.key === 'MOONVEIL_ENGINE') assert.match(e.v, /^rules\b/);
    if (e.key.startsWith('LIVEKIT_')) assert.deepEqual([e.kind, e.v], ['sync', 'false'], `${e.key} must be dashboard-only`);
  }
  assert.doesNotMatch(y, /SECRET\b.*value:|API_KEY\b.*value:/);
  assert.match(y, /numInstances: 1\b/);
  assert.match(y, /plan: free\b/);
  assert.match(y, /healthCheckPath: \/healthz\b/);
});
