// Orchestrator: starts the in-repo LiveKit server (port 4300) and the spike server (4302)
// unless already up, runs the Playwright suite, then stops only what it started.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
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
if (!(await up('http://127.0.0.1:4300/'))) {
  const lkLog = fs.openSync(path.join(dir, '.livekit.log'), 'w');
  started.push(spawn(path.join(dir, '.bin/livekit-server'), ['--config', path.join(dir, 'config/livekit.yaml')], { stdio: ['ignore', lkLog, lkLog] }));
  if (!(await wait('http://127.0.0.1:4300/'))) { console.error('livekit-server did not start (build it: see README)'); process.exit(2); }
}
if (!(await up('http://127.0.0.1:4302/api/state'))) {
  started.push(spawn(process.execPath, [path.join(dir, 'server.mjs')], { stdio: 'inherit' }));
  if (!(await wait('http://127.0.0.1:4302/api/state'))) { console.error('spike server did not start'); process.exit(2); }
}

const pw = spawn(process.execPath, [path.join(dir, 'node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], { stdio: 'inherit', cwd: dir, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(dir, '.browsers') } });
pw.on('exit', async (code) => {
  // Stop only what this script started; escalate to SIGKILL if a child ignores SIGTERM.
  await Promise.all(started.map((p) => new Promise((resolve) => {
    if (p.exitCode !== null) return resolve();
    const hard = setTimeout(() => p.kill('SIGKILL'), 3000);
    p.once('exit', () => { clearTimeout(hard); resolve(); });
    p.kill('SIGTERM');
  })));
  process.exit(code ?? 1);
});
