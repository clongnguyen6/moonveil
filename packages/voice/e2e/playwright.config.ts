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

// Fake microphone: a speech-like signal, not a steady tone. The product mic runs with noise suppression,
// AGC and echo cancellation on, and a suppressor treats a constant 440 Hz tone as stationary noise (measured:
// ~1/40 of the energy). 10 s of 200 ms bursts (fundamental cycling 220..880 Hz + 2 harmonics, 180 ms gaps),
// 48 kHz mono 16-bit, peak -6 dBFS. Chromium loops it.
const wav = path.join(cache, 'speechlike.wav');
if (!fs.existsSync(wav)) {
  const sr = 48000, n = sr * 10, amp = 0.5;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  const f0s = [220, 330, 440, 550, 660, 880];
  const period = Math.round(sr * 0.38), burst = Math.round(sr * 0.2);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / period), t = (i % period) / sr;
    let v = 0;
    if (i % period < burst) {
      const f0 = f0s[k % f0s.length]! * (1 + 0.05 * Math.sin((2 * Math.PI * i) / sr));
      const env = Math.sin((Math.PI * (i % period)) / burst); // smooth burst envelope
      v = env * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.25 * Math.sin(2 * Math.PI * 3 * f0 * t)) / 1.75;
    }
    buf.writeInt16LE(Math.round(amp * 32767 * v), 44 + i * 2);
  }
  fs.writeFileSync(wav, buf);
}

// Browser processes get an in-repo HOME/TMPDIR; headless-shell Chromium only (no `channel`).
const browserHome = path.join(cache, 'home');
fs.mkdirSync(browserHome, { recursive: true });

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /cloud-check\.spec\.ts/, // Cloud-only (needs a deployed app); rotation-gap runs in both
  fullyParallel: false,
  workers: 1,
  timeout: 12 * 60_000,
  expect: { timeout: 45_000 }, // shared machine: other owners' suites may run concurrently
  // Artifacts are kept per run (Playwright wipes outputDir at start): set VOICE_E2E_RUN to name a run.
  reporter: [['list'], ['json', { outputFile: path.join(cache, `results-${process.env.VOICE_E2E_RUN ?? 'latest'}.json`) }]],
  outputDir: path.join(cache, `results-${process.env.VOICE_E2E_RUN ?? 'latest'}`),
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
