import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
// Pure parts of the tooling; nothing here downloads, builds or starts anything.
import { DOCKER_IMAGE, LIVEKIT_VERSION, SHA256, cacheDir, goEnv, goIsRecentEnough, parseGoVersion, releaseAsset, renderConfig, repoRoot } from '../tooling/livekit.mjs';

test('pinned version has checksums for every Linux release asset and the source tarball', () => {
  assert.equal(LIVEKIT_VERSION, '1.13.10');
  for (const arch of ['amd64', 'arm64', 'armv7']) assert.match(SHA256[`livekit_${LIVEKIT_VERSION}_linux_${arch}.tar.gz`] ?? '', /^[0-9a-f]{64}$/);
  assert.match(SHA256[`v${LIVEKIT_VERSION}.tar.gz`] ?? '', /^[0-9a-f]{64}$/);
  assert.equal(DOCKER_IMAGE, `livekit/livekit-server:v${LIVEKIT_VERSION}`);
});

test('release asset only for Linux; other platforms build from source', () => {
  assert.equal(releaseAsset('linux', 'x64'), 'livekit_1.13.10_linux_amd64.tar.gz');
  assert.equal(releaseAsset('linux', 'arm64'), 'livekit_1.13.10_linux_arm64.tar.gz');
  assert.equal(releaseAsset('darwin', 'arm64'), null);
  assert.equal(releaseAsset('linux', 'ppc64'), null);
});

test('Go version gate', () => {
  assert.deepEqual(parseGoVersion('go version go1.27.1 darwin/arm64'), [1, 27]);
  assert.equal(goIsRecentEnough([1, 26]), true);
  assert.equal(goIsRecentEnough([1, 25]), false);
  assert.equal(goIsRecentEnough(null), false);
});

test('rendered config binds loopback, pins ports and keeps auto_create off', () => {
  const cfg = renderConfig({ port: 4300, tcpPort: 4301, udpStart: 4310, udpEnd: 4350, apiKey: 'k', apiSecret: 's' });
  assert.match(cfg, /^port: 4300$/m);
  assert.match(cfg, /- 127\.0\.0\.1$/m);
  assert.match(cfg, /tcp_port: 4301/);
  assert.match(cfg, /port_range_start: 4310\n\s+port_range_end: 4350/);
  assert.match(cfg, /auto_create: false/);
  assert.match(cfg, /^\s+k: s$/m);
});

test('every path the tooling writes is under the repo .cache', () => {
  const cache = path.join(repoRoot, '.cache');
  assert.ok(cacheDir.startsWith(cache), cacheDir);
  const env = goEnv({});
  for (const k of ['HOME', 'GOCACHE', 'GOMODCACHE', 'GOPATH', 'GOTMPDIR', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME']) {
    assert.ok(env[k]?.startsWith(cacheDir), `${k}=${env[k]}`);
  }
  assert.equal(env.GOENV, 'off');
  assert.equal(env.GOTOOLCHAIN, 'local');
});
