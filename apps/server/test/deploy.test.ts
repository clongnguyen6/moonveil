// ADR 0010 deploy switches (host-neutral): env -> allowed /ws origins, LAN listing, port warning. Unset = local.
// Plus the server (an allowed origin passes even when a proxy rewrites Host) and the deploy/ drafts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WebSocket as WsClient } from 'ws';
import { allowedOrigins, lanEnabled, persistInfo, publicOrigin, revision, warnPort } from '../src/deploy.ts';
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

test('revision: MOONVEIL_REVISION, else RAILWAY_GIT_COMMIT_SHA, else unknown; only a hex SHA', () => {
  assert.equal(revision({}), 'unknown');
  assert.equal(revision({ RAILWAY_GIT_COMMIT_SHA: '35151F29D0B1A3FB018DD33B6A7B67C6EE037DF3' }), '35151f29d0b1a3fb018dd33b6a7b67c6ee037df3');
  assert.equal(revision({ MOONVEIL_REVISION: 'abc1234', RAILWAY_GIT_COMMIT_SHA: 'def5678' }), 'abc1234');
  assert.equal(revision({ MOONVEIL_REVISION: '<script>', RAILWAY_GIT_COMMIT_SHA: 'def5678' }), 'def5678');
  assert.equal(revision({ MOONVEIL_REVISION: 'main' }), 'unknown');
});

test('persistInfo: volume (path), temp (Railway without volume), disk (elsewhere), off', () => {
  const rw = { RAILWAY_SERVICE_ID: 'svc', RAILWAY_VOLUME_MOUNT_PATH: '/data' };
  assert.deepEqual(persistInfo(rw, '/data/rooms', true), { mode: 'volume', path: '/data/rooms' });
  assert.deepEqual(persistInfo({ ...rw, RAILWAY_VOLUME_MOUNT_PATH: '/data/' }, '/data/rooms', true), { mode: 'volume', path: '/data/rooms' });
  assert.deepEqual(persistInfo(rw, '/database/rooms', true), { mode: 'temp' }, 'prefix match is per path segment');
  assert.deepEqual(persistInfo({ RAILWAY_SERVICE_ID: 'svc' }, '/app/.data/rooms', true), { mode: 'temp' });
  assert.deepEqual(persistInfo({}, '/home/x/.data/rooms', true), { mode: 'disk' });
  assert.deepEqual(persistInfo(rw, '/data/rooms', false), { mode: 'off' });
});

test('GET /api/status from the real entry: revision, uptime, volume persistence, voice configured; no LiveKit host, key or secret', async () => {
  const port = await new Promise<number>((r) => {
    const n = netServer().listen(0, '127.0.0.1', () => {
      const p = (n.address() as { port: number }).port;
      n.close(() => r(p));
    });
  });
  const vol = mkdtempSync(join(tmpdir(), 'mv-vol-'));
  const lk = { LIVEKIT_URL: 'https://status-test-project.livekit.cloud', LIVEKIT_PUBLIC_WS: 'wss://status-test-project.livekit.cloud', LIVEKIT_API_KEY: 'APIstatusKEY123', LIVEKIT_API_SECRET: 'status-secret-value-0123456789abcdef' };
  const p = spawn(process.execPath, ['apps/server/src/main.ts'], {
    cwd: join(import.meta.dirname, '../../..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'fixture', MOONVEIL_DATA_DIR: join(vol, 'rooms'), RAILWAY_VOLUME_MOUNT_PATH: vol, RAILWAY_SERVICE_ID: 'svc', MOONVEIL_REVISION: '35151f2', ...lk },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  try {
    await new Promise<void>((r, j) => {
      p.stdout.on('data', () => out.includes('moonveil server') && r());
      p.once('exit', (c) => j(new Error(`exited ${c}: ${out}`)));
    });
    const res = await fetch(`http://127.0.0.1:${port}/api/status`);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    assert.equal(body.revision, '35151f2');
    assert.equal(body.engine, 'fixture');
    assert.deepEqual(body.persist, { mode: 'volume', path: join(vol, 'rooms') });
    assert.equal(body.voice, 'configured');
    assert.ok(typeof body.uptimeSec === 'number' && body.uptimeSec >= 0);
    assert.deepEqual(Object.keys(body).sort(), ['engine', 'persist', 'revision', 'uptimeSec', 'voice']);
    for (const v of [...Object.values(lk), 'status-test-project', 'livekit']) assert.ok(!text.includes(v), `status leaks ${v}`);
  } finally {
    p.kill('SIGKILL');
  }
});

