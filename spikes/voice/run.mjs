// Orchestrator: starts the in-repo LiveKit server (port 4300) and the spike server (4302)
// unless already up, runs the Playwright suite, then stops only what it started.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
// Keep every temp write (Playwright browser profiles, Chromium scratch) inside the repo.
const TMP = path.join(dir, '.tmp');
fs.mkdirSync(TMP, { recursive: true });
process.env.TMPDIR = TMP;
const up = async (url) => { try { const r = await fetch(url); return r.status < 500; } catch { return false; } };
const wait = async (url, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await up(url)) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };

// Fake-mic fixture: 10 s continuous 440 Hz tone, 48 kHz mono 16-bit, -12 dBFS. Generated, not committed.
const wav = path.join(dir, 'fixtures/tone440.wav');
if (!fs.existsSync(wav)) {
  const sr = 48000, n = sr * 10, amp = 0.25;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / sr)), 44 + i * 2);
  fs.mkdirSync(path.dirname(wav), { recursive: true }); fs.writeFileSync(wav, buf);
}

const started = [];
// Stop only what this script started; escalate to SIGKILL if a child ignores SIGTERM.
const stopStarted = () => Promise.all(started.map((p) => new Promise((resolve) => {
  if (p.exitCode !== null) return resolve();
  const hard = setTimeout(() => p.kill('SIGKILL'), 3000);
  p.once('exit', () => { clearTimeout(hard); resolve(); });
  p.kill('SIGTERM');
})));
const fail = async (msg) => { console.error(msg); await stopStarted(); process.exit(2); };
if (!(await up('http://127.0.0.1:4300/'))) {
  const lkLog = fs.openSync(path.join(dir, '.livekit.log'), 'w');
  started.push(spawn(path.join(dir, '.bin/livekit-server'), ['--config', path.join(dir, 'config/livekit.yaml')], { stdio: ['ignore', lkLog, lkLog] }));
  if (!(await wait('http://127.0.0.1:4300/'))) await fail('livekit-server did not start (build it: see README)');
}
if (!(await up('http://127.0.0.1:4302/api/state'))) {
  started.push(spawn(process.execPath, [path.join(dir, 'server.mjs')], { stdio: 'inherit' }));
  if (!(await wait('http://127.0.0.1:4302/api/state'))) await fail('spike server did not start');
}

// Throwaway TLS certs for the secure-context tests (never installed anywhere).
if (!fs.existsSync(path.join(dir, '.certs/leaf.spki'))) spawnSync('sh', [path.join(dir, 'make-certs.sh')], { stdio: 'inherit' });
{
  // Node's fetch rejects the throwaway cert; probe the proxy port with a plain TCP connect instead.
  const net = await import('node:net');
  const tcpUp = () => new Promise((r) => { const c = net.connect(4303, '127.0.0.1', () => { c.destroy(); r(true); }); c.on('error', () => r(false)); });
  if (!(await tcpUp())) {
    started.push(spawn(process.execPath, [path.join(dir, 'tls-proxy.mjs')], { stdio: 'inherit' }));
    const t = Date.now();
    while (Date.now() - t < 10000 && !(await tcpUp())) await new Promise((r) => setTimeout(r, 200));
    if (!(await tcpUp())) await fail('tls proxy did not start');
  }
}

const pw = spawn(process.execPath, [path.join(dir, 'node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], { stdio: 'inherit', cwd: dir, env: { ...process.env, TMPDIR: TMP, PLAYWRIGHT_BROWSERS_PATH: path.join(dir, '.browsers') } });
pw.on('exit', async (code) => { await stopStarted(); process.exit(code ?? 1); });
