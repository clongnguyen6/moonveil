#!/usr/bin/env node
// Runs Playwright with OS-assigned free ports unless E2E_PORT / E2E_RESTART_PORT / E2E_REAL_PORT are set, so several
// owners' e2e runs on one machine never collide. Workers inherit the env. Usage: node scripts/e2e-run.mjs [playwright args]
// E2E_VOICE=1: also starts the pinned LiveKit (@moonveil/voice tooling; writes only under .cache/livekit) and passes
// LIVEKIT_* to the real-engine server. UDP media ports: 4160-4199 (foundation range); signal/TCP: free OS ports.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const free = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const env = { ...process.env };
env.E2E_PORT ??= String(await free());
env.E2E_RESTART_PORT ??= String(await free());
env.E2E_REAL_PORT ??= String(await free());
let livekit = null;
if (env.E2E_VOICE === '1') {
  const { startLiveKit } = await import('../packages/voice/tooling/livekit.mjs');
  livekit = await startLiveKit({ port: await free(), tcpPort: await free(), udpStart: 4160, udpEnd: 4199 });
  Object.assign(env, {
    LIVEKIT_URL: livekit.url,
    LIVEKIT_PUBLIC_WS: livekit.wsUrl,
    LIVEKIT_API_KEY: livekit.apiKey,
    LIVEKIT_API_SECRET: livekit.apiSecret,
  });
  console.log(`e2e: LiveKit (${livekit.kind}) at ${livekit.wsUrl}`);
}
// E2E_GREP filters tests (nested npm scripts make --grep hard to pass through).
const grep = env.E2E_GREP ? ['--grep', env.E2E_GREP] : [];
const child = spawn('playwright', ['test', ...grep, ...process.argv.slice(2)], { stdio: 'inherit', env });
const done = async (code) => {
  if (livekit) await livekit.stop();
  process.exit(code);
};
child.on('exit', (code, signal) => void done(signal ? 1 : (code ?? 1)));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
