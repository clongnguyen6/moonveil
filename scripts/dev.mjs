// Dev: server (watch) on PORT=4100 + Vite on WEB_PORT=4101 (proxies /ws). Open http://127.0.0.1:4101.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npm', ['run', 'dev', '-w', '@moonveil/server'], { stdio: 'inherit', env: { ...process.env, STATIC_DIR: '' } }),
  spawn('npm', ['run', 'dev', '-w', '@moonveil/web'], { stdio: 'inherit' }),
];
const stop = () => procs.forEach((p) => p.kill('SIGTERM'));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, stop);
for (const p of procs) p.on('exit', (code) => { stop(); process.exitCode = code ?? 1; });
