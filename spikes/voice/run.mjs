// Orchestrator: starts the in-repo LiveKit server (port 4300) and the spike server (4302)
// unless already up, runs the Playwright suite, then stops only what it started.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const up = async (url) => { try { const r = await fetch(url); return r.status < 500; } catch { return false; } };
const wait = async (url, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await up(url)) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };

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
pw.on('exit', (code) => { for (const p of started) p.kill('SIGTERM'); process.exit(code ?? 1); });
