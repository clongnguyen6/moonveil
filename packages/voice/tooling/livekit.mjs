#!/usr/bin/env node
// LiveKit server for local dev and tests, pinned, with every write inside the repo (.cache/livekit/).
// No global install. Acquire order: existing binary -> Linux release tarball (sha256 checked) ->
// build from the source tarball with the host Go (all Go dirs + HOME in-repo) -> Docker (optional
// fallback, only if a daemon is running) -> fail with the options printed.
//
//   node packages/voice/tooling/livekit.mjs ensure            # get the binary (or confirm docker)
//   node packages/voice/tooling/livekit.mjs start [--port 4300] [--tcp 4301] [--udp 4310-4350]
//   import { ensureLiveKit, startLiveKit } from '@moonveil/voice/tooling/livekit';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIVEKIT_VERSION = '1.13.10';
// From https://github.com/livekit/livekit/releases/download/v1.13.10/checksums.txt (fetched 2026-10-16)
// and the sha256 of https://github.com/livekit/livekit/archive/refs/tags/v1.13.10.tar.gz (computed twice).
export const SHA256 = {
  'livekit_1.13.10_linux_amd64.tar.gz': 'c25a3e45fb922e9a93c6443d10c0ed041ba64342097e38632331736630283165',
  'livekit_1.13.10_linux_arm64.tar.gz': 'ff60607e1931ff078576882fa11c087aa5821d635ac0c47f56ff77e203e32006',
  'livekit_1.13.10_linux_armv7.tar.gz': '53527b3a0c52661dcac726614bcefb42702e36fd7bf9b389be971f8d8e4661c1',
  'v1.13.10.tar.gz': 'd1b93ced314b14654faceeb99627a79114b8ebe002bb5d620be4a185db83a4b2',
};
export const MIN_GO = [1, 26];
export const DOCKER_IMAGE = `livekit/livekit-server:v${LIVEKIT_VERSION}`;

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = process.env.MOONVEIL_ROOT || path.resolve(here, '../../..');
export const cacheDir = path.join(repoRoot, '.cache', 'livekit', LIVEKIT_VERSION);
export const binaryPath = path.join(cacheDir, process.platform === 'win32' ? 'livekit-server.exe' : 'livekit-server');

export function releaseAsset(platform = process.platform, arch = process.arch) {
  if (platform !== 'linux') return null;
  const map = { x64: 'amd64', arm64: 'arm64', arm: 'armv7' };
  const a = map[arch];
  return a ? `livekit_${LIVEKIT_VERSION}_linux_${a}.tar.gz` : null;
}

export function parseGoVersion(s) {
  const m = /go(\d+)\.(\d+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
export function goIsRecentEnough(v) {
  return !!v && (v[0] > MIN_GO[0] || (v[0] === MIN_GO[0] && v[1] >= MIN_GO[1]));
}

// Render the server config. auto_create off: only names the game server chose can be joined.
export function renderConfig({ port, tcpPort, udpStart, udpEnd, apiKey, apiSecret, bind = '127.0.0.1' }) {
  return [
    `port: ${port}`,
    'bind_addresses:',
    `  - ${bind}`,
    'rtc:',
    `  tcp_port: ${tcpPort}`,
    `  port_range_start: ${udpStart}`,
    `  port_range_end: ${udpEnd}`,
    '  use_external_ip: false',
    'keys:',
    `  ${apiKey}: ${apiSecret}`,
    'logging:',
    '  level: info',
    '  json: false',
    'room:',
    '  auto_create: false',
    '  empty_timeout: 600',
    '',
  ].join('\n');
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function download(url, dest, expectedSha) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download ${url}: HTTP ${res.status}`);
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  const got = sha256(tmp);
  if (got !== expectedSha) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`checksum mismatch for ${path.basename(dest)}: got ${got}, want ${expectedSha}`);
  }
  fs.renameSync(tmp, dest);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status ?? r.signal})`);
}

function dockerAvailable() {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' });
  return r.status === 0;
}

// Go environment: every path Go might write goes under .cache/livekit/go*. HOME moves Go's
// config/telemetry dir (macOS: ~/Library/Application Support/go) into the repo; GOENV=off and
// GOTOOLCHAIN=local prevent config writes and toolchain downloads.
export function goEnv(base = process.env) {
  const g = (n) => path.join(cacheDir, n);
  for (const d of ['gohome', 'gocache', 'gomodcache', 'gopath', 'gotmp']) fs.mkdirSync(g(d), { recursive: true });
  return {
    ...base,
    HOME: g('gohome'),
    XDG_CONFIG_HOME: path.join(g('gohome'), '.config'),
    XDG_CACHE_HOME: path.join(g('gohome'), '.cache'),
    GOCACHE: g('gocache'),
    GOMODCACHE: g('gomodcache'),
    GOPATH: g('gopath'),
    GOTMPDIR: g('gotmp'),
    TMPDIR: g('gotmp'),
    GOENV: 'off',
    GOTOOLCHAIN: 'local',
    GOFLAGS: '-mod=mod',
  };
}

async function fromRelease(asset) {
  const tgz = path.join(cacheDir, asset);
  if (!fs.existsSync(tgz)) await download(`https://github.com/livekit/livekit/releases/download/v${LIVEKIT_VERSION}/${asset}`, tgz, SHA256[asset]);
  run('tar', ['xzf', tgz, '-C', cacheDir, 'livekit-server']);
}

async function fromSource() {
  const goVersion = spawnSync('go', ['version'], { encoding: 'utf8' });
  if (goVersion.status !== 0) throw new Error('no Go toolchain on PATH');
  const v = parseGoVersion(goVersion.stdout);
  if (!goIsRecentEnough(v)) throw new Error(`Go >= ${MIN_GO.join('.')} required, found ${goVersion.stdout.trim()}`);
  const tgz = path.join(cacheDir, `v${LIVEKIT_VERSION}.tar.gz`);
  if (!fs.existsSync(tgz)) await download(`https://github.com/livekit/livekit/archive/refs/tags/v${LIVEKIT_VERSION}.tar.gz`, tgz, SHA256[`v${LIVEKIT_VERSION}.tar.gz`]);
  const src = path.join(cacheDir, 'src');
  fs.rmSync(src, { recursive: true, force: true });
  fs.mkdirSync(src, { recursive: true });
  run('tar', ['xzf', tgz, '-C', src, '--strip-components=1']);
  console.error(`[livekit] building ${LIVEKIT_VERSION} from source with ${goVersion.stdout.trim()} (all Go dirs in ${cacheDir})`);
  run('go', ['build', '-o', binaryPath, './cmd/server'], { cwd: src, env: goEnv() });
}

// Returns { kind: 'binary', path } or { kind: 'docker', image }.
export async function ensureLiveKit({ allowDocker = true } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  if (fs.existsSync(binaryPath)) return { kind: 'binary', path: binaryPath };
  const errors = [];
  const asset = releaseAsset();
  if (asset) {
    try {
      await fromRelease(asset);
      return { kind: 'binary', path: binaryPath };
    } catch (err) {
      errors.push(`release: ${err.message}`);
    }
  } else errors.push(`release: no prebuilt livekit-server for ${process.platform}/${process.arch} (Linux only)`);
  try {
    await fromSource();
    return { kind: 'binary', path: binaryPath };
  } catch (err) {
    errors.push(`source: ${err.message}`);
  }
  if (allowDocker && dockerAvailable()) return { kind: 'docker', image: DOCKER_IMAGE };
  errors.push('docker: no running daemon (optional fallback)');
  throw new Error(
    `cannot provide livekit-server ${LIVEKIT_VERSION}:\n  - ${errors.join('\n  - ')}\n` +
      `Options: install Go >= ${MIN_GO.join('.')} (source build), run on Linux (release binary), or start Docker.`,
  );
}

// Start LiveKit on the given ports. Resolves when the HTTP port answers. stop() ends it.
export async function startLiveKit({ port = 4300, tcpPort = 4301, udpStart = 4310, udpEnd = 4350, apiKey = 'moonveil-dev', apiSecret = 'moonveil-dev-secret-not-for-production-0000000000', bind = '127.0.0.1', logFile } = {}) {
  const how = await ensureLiveKit();
  const cfgPath = path.join(cacheDir, `livekit-${port}.yaml`);
  fs.writeFileSync(cfgPath, renderConfig({ port, tcpPort, udpStart, udpEnd, apiKey, apiSecret, bind: how.kind === 'docker' ? '0.0.0.0' : bind }));
  const log = fs.openSync(logFile ?? path.join(cacheDir, `livekit-${port}.log`), 'a');
  let child;
  if (how.kind === 'binary') {
    child = spawn(how.path, ['--config', cfgPath], { stdio: ['ignore', log, log], env: { ...process.env, TMPDIR: path.join(cacheDir, 'gotmp') } });
  } else {
    const ports = ['-p', `127.0.0.1:${port}:${port}`, '-p', `127.0.0.1:${tcpPort}:${tcpPort}`, '-p', `127.0.0.1:${udpStart}-${udpEnd}:${udpStart}-${udpEnd}/udp`];
    child = spawn('docker', ['run', '--rm', ...ports, '-v', `${cfgPath}:/livekit.yaml:ro`, how.image, '--config', '/livekit.yaml'], { stdio: ['ignore', log, log] });
  }
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.status < 500) break;
    } catch {}
    if (child.exitCode !== null) throw new Error(`livekit exited early with ${child.exitCode}; see ${cfgPath.replace('.yaml', '.log')}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  const stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const hard = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => {
        clearTimeout(hard);
        resolve();
      });
      child.kill('SIGTERM');
    });
  return { url, wsUrl: `ws://127.0.0.1:${port}`, apiKey, apiSecret, pid: child.pid, kind: how.kind, stop };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name, def) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : def;
  };
  if (cmd === 'ensure') {
    const how = await ensureLiveKit();
    console.log(how.kind === 'binary' ? how.path : `docker ${how.image}`);
  } else if (cmd === 'start') {
    const [udpStart, udpEnd] = String(flag('udp', '4310-4350')).split('-').map(Number);
    const lk = await startLiveKit({ port: Number(flag('port', 4300)), tcpPort: Number(flag('tcp', 4301)), udpStart, udpEnd });
    console.log(`livekit ${LIVEKIT_VERSION} (${lk.kind}) ${lk.url} key=${lk.apiKey}; Ctrl-C to stop`);
    for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => lk.stop().then(() => process.exit(0)));
  } else {
    console.error('usage: livekit.mjs ensure | start [--port N] [--tcp N] [--udp A-B]');
    process.exit(2);
  }
}
void os;
