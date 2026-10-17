// ADR 0010 deploy switches (host-neutral): env -> allowed /ws origins, LAN listing, port warning. Unset = local.
// Plus the server (an allowed origin passes even when a proxy rewrites Host) and the deploy/ drafts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { WebSocket as WsClient } from 'ws';
import { allowedOrigins, lanEnabled, publicOrigin, warnPort } from '../src/deploy.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';
import { createMoonveilServer } from '../src/server.ts';
import { listenFree } from './ports.ts';

test('local env: no extra origins, LAN on, port warning outside 4100-4199; platform vars alone change nothing', () => {
  assert.deepEqual(allowedOrigins({}), []);
  assert.equal(publicOrigin({}), undefined);
  assert.equal(lanEnabled({}), true);
  assert.equal(warnPort({}, 4100), false);
  assert.equal(warnPort({}, 10000), true);
  const platform = { RENDER: 'true', RENDER_EXTERNAL_URL: 'https://x.onrender.com', RAILWAY_PUBLIC_DOMAIN: 'x.up.railway.app' };
  assert.deepEqual(allowedOrigins(platform), []);
  assert.equal(lanEnabled(platform), true);
});

test('MOONVEIL_PUBLIC_ORIGIN: hosted deploy = origin allowed, LAN off, no port warning', () => {
  const env = { MOONVEIL_PUBLIC_ORIGIN: ' https://moonveil.up.railway.app/ ' };
  assert.equal(publicOrigin(env), 'https://moonveil.up.railway.app');
  assert.deepEqual(allowedOrigins(env), ['https://moonveil.up.railway.app']);
  assert.equal(lanEnabled(env), false);
  assert.equal(warnPort(env, 8080), false);
  assert.throws(() => publicOrigin({ MOONVEIL_PUBLIC_ORIGIN: 'moonveil.up.railway.app' }), 'a bare domain is a startup error');
});

test('MOONVEIL_ALLOWED_ORIGINS: trimmed, normalised, deduped with the public origin; non-http(s) or junk is a startup error', () => {
  assert.deepEqual(
    allowedOrigins({ MOONVEIL_ALLOWED_ORIGINS: ' https://a.example/path , https://a.example,http://b.example:4100 ', MOONVEIL_PUBLIC_ORIGIN: 'https://a.example' }),
    ['https://a.example', 'http://b.example:4100'],
  );
  assert.throws(() => allowedOrigins({ MOONVEIL_ALLOWED_ORIGINS: 'ftp://a.example' }));
  assert.throws(() => allowedOrigins({ MOONVEIL_ALLOWED_ORIGINS: 'not a url' }));
  assert.equal(lanEnabled({ MOONVEIL_LAN: '0' }), false);
});

test('ws: allowed origin passes with a rewritten Host; unlisted origin and same-origin rules unchanged', async () => {
  const srv = createMoonveilServer({ engine: () => createFixtureEngine() as RulesEngine<unknown>, allowedOrigins: ['https://moonveil.up.railway.app'] });
  const port = await listenFree(srv.http);
  const open = (origin: string, host: string) =>
    new Promise<string>((resolve) => {
      const ws = new WsClient(`ws://127.0.0.1:${port}/ws`, { headers: { origin, host } });
      ws.on('open', () => (ws.close(), resolve('open')));
      ws.on('error', (e) => resolve(e.message));
    });
  try {
    assert.equal(await open('https://moonveil.up.railway.app', 'internal:8080'), 'open');
    assert.match(await open('https://evil.example', 'internal:8080'), /403/);
    assert.match(await open('http://moonveil.up.railway.app', 'internal:8080'), /403/, 'scheme is part of the origin');
    assert.equal(await open('http://internal:8080', 'internal:8080'), 'open', 'same-origin still accepted');
  } finally {
    await srv.stop();
  }
});

const draft = (f: string) => readFileSync(join(import.meta.dirname, '../../../deploy', f), 'utf8');
const TEST_ONLY = /^(MOONVEIL_TEST_|MOONVEIL_FIXTURE_|E2E_|MOONVEIL_PERSIST$)/;
const SECRETS = ['LIVEKIT_URL', 'LIVEKIT_PUBLIC_WS', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'MOONVEIL_PUBLIC_ORIGIN'];

test('deploy/railway.ts draft (primary): no test-only vars or persistence switch, secrets preserve()d, data dir on the volume, one replica', () => {
  const t = draft('railway.ts');
  const env = Object.fromEntries([...t.matchAll(/^\s+([A-Z][A-Z0-9_]+): (.+?),?(?:\s*\/\/.*)?$/gm)].map((m) => [m[1]!, m[2]!]));
  assert.ok(Object.keys(env).length >= 9, 'parsed the env block');
  for (const k of Object.keys(env)) assert.doesNotMatch(k, TEST_ONLY, `forbidden var ${k}`);
  for (const k of SECRETS) assert.equal(env[k], 'preserve()', `${k} must be dashboard-only`);
  assert.equal(env.MOONVEIL_ENGINE, "'rules'");
  const mount = /volumeMounts: \{ '([^']+)': rooms \}/.exec(t)?.[1];
  assert.ok(mount && env.MOONVEIL_DATA_DIR?.startsWith(`'${mount}/`), 'MOONVEIL_DATA_DIR is inside the volume mount');
  assert.equal(env.RAILWAY_DEPLOYMENT_DRAINING_SECONDS, "'5'", 'grace for the SIGTERM restart notice');
  assert.match(t, /replicas: \{ \[REGION\]: 1 \}/);
  assert.match(t, /healthcheck: '\/healthz'/);
  assert.match(t, /start: 'node apps\/server\/src\/main\.ts'/);
});

test('deploy/render.yaml draft (alternative): no test-only vars or persistence switch, no secret values, one instance', () => {
  const y = draft('render.yaml');
  const entries = [...y.matchAll(/- key: (\S+)\n\s+(value|sync): (\S+)/g)].map((m) => ({ key: m[1]!, kind: m[2]!, v: m[3]! }));
  assert.ok(entries.length >= 9, 'parsed the envVars');
  for (const e of entries) assert.doesNotMatch(e.key, TEST_ONLY, `forbidden var ${e.key}`);
  for (const k of SECRETS) {
    const e = entries.find((x) => x.key === k);
    assert.deepEqual([e?.kind, e?.v], ['sync', 'false'], `${k} must be dashboard-only`);
  }
  assert.equal(entries.find((e) => e.key === 'MOONVEIL_ENGINE')?.v, 'rules');
  assert.match(y, /numInstances: 1\b/);
  assert.match(y, /healthCheckPath: \/healthz\b/);
});
