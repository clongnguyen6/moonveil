#!/usr/bin/env node
// Web server command for the voice e2e suite: builds the web shell once, starts the pinned LiveKit
// (voice ports 4300–4399) and the real-engine game server wired to it, and stops both on SIGTERM.
// Env in:  PORT (game server, default 4350), LIVEKIT_PORT (default 4360; TCP = +1; UDP = 4370–4399),
//          MOONVEIL_TEST_TIME_SCALE (default 3: server clock/timers 3x faster, approved timings unchanged)
// Env out to the server (names proposed for foundation's wiring; see packages/voice/README.md):
//   LIVEKIT_URL, LIVEKIT_PUBLIC_WS, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLiveKit } from '../tooling/livekit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.MOONVEIL_ROOT || path.resolve(here, '../../..');
const port = Number(process.env.PORT ?? 4350);
const lkPort = Number(process.env.LIVEKIT_PORT ?? 4360);
const apiKey = 'moonveil-e2e';
const apiSecret = 'moonveil-e2e-secret-not-for-production-000000000';

if (process.env.VOICE_E2E_SKIP_BUILD !== '1') {
  const b = spawnSync('npm', ['run', 'build', '-w', '@moonveil/web'], { cwd: root, stdio: 'inherit', env: process.env });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

const lk = await startLiveKit({ port: lkPort, tcpPort: lkPort + 1, udpStart: 4370, udpEnd: 4399, apiKey, apiSecret, logFile: path.join(root, '.cache', 'voice-e2e', 'livekit.log') });
console.log(`[voice-e2e] livekit ${lk.kind} ${lk.url}`);

fs.mkdirSync(path.join(root, '.cache', 'voice-e2e', 'data'), { recursive: true });
const server = spawn(process.execPath, [path.join(root, 'apps/server/src/main.ts')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    MOONVEIL_ENGINE: 'rules',
    MOONVEIL_TEST_TIME_SCALE: process.env.MOONVEIL_TEST_TIME_SCALE ?? '3',
    MOONVEIL_PERSIST: '0',
    MOONVEIL_DATA_DIR: path.join(root, '.cache', 'voice-e2e', 'data'),
    LIVEKIT_URL: lk.url,
    LIVEKIT_PUBLIC_WS: lk.wsUrl,
    LIVEKIT_API_KEY: apiKey,
    LIVEKIT_API_SECRET: apiSecret,
  },
});

const stop = async () => {
  if (server.exitCode === null) {
    const hard = setTimeout(() => server.kill('SIGKILL'), 3000);
    await new Promise((r) => server.once('exit', () => { clearTimeout(hard); r(undefined); }) && server.kill('SIGTERM'));
  }
  await lk.stop();
};
server.on('exit', (code) => void lk.stop().then(() => process.exit(code ?? 1)));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => void stop().then(() => process.exit(0)));
