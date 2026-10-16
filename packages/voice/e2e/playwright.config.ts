// Voice browser full-match suite. Run from the repo root so caches stay in .cache/:
//   node scripts/env.mjs npm run e2e -w @moonveil/voice
// Ports: game server E2E_PORT (default 4350), LiveKit 4360/4361 + UDP 4370–4399 (voice range 4300–4399).
import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const port = Number(process.env.E2E_PORT ?? 4350);
const cache = path.join(root, '.cache', 'voice-e2e');
fs.mkdirSync(cache, { recursive: true });

// Fake microphone: 10 s continuous 440 Hz tone, 48 kHz mono 16-bit, -12 dBFS. Chromium loops it.
const wav = path.join(cache, 'tone440.wav');
if (!fs.existsSync(wav)) {
  const sr = 48000, n = sr * 10, amp = 0.25;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / sr)), 44 + i * 2);
  fs.writeFileSync(wav, buf);
}

// Browser processes get an in-repo HOME/TMPDIR; headless-shell Chromium only (no `channel`).
const browserHome = path.join(cache, 'home');
fs.mkdirSync(browserHome, { recursive: true });

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 12 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['json', { outputFile: path.join(cache, 'results.json') }]],
  outputDir: path.join(cache, 'results'),
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    permissions: ['microphone'],
    trace: 'retain-on-failure',
    launchOptions: {
      env: { ...process.env, HOME: browserHome, TMPDIR: process.env.TMPDIR ?? path.join(root, '.cache', 'tmp') },
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${wav}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: {
    command: `node e2e/serve.mjs`,
    cwd: here.replace(/\/e2e$/, ''),
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PORT: String(port), LIVEKIT_PORT: String(process.env.LIVEKIT_PORT ?? 4360) },
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
});
