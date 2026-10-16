import { defineConfig } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// All browser binaries live in ./.browsers (gitignored); see .npmrc / README.
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(__dirname, '.browsers');

// TLS mode (npm run test:tls): the page is served from https://camp.local:4303 through tls-proxy.mjs.
// camp.local is mapped to 127.0.0.1 by a Chromium flag (no /etc/hosts edit) and the throwaway leaf
// certificate is trusted by SPKI pin (no trust-store change). Over plain http, camp.local is an
// insecure origin, exactly like a phone hitting http://192.168.x.x.
const tls = process.env.VOICE_TLS === '1';
const spki = tls ? fs.readFileSync(path.resolve(__dirname, '.certs/leaf.spki'), 'utf8').trim() : '';
const tlsArgs = tls ? ['--host-resolver-rules=MAP camp.local 127.0.0.1', `--ignore-certificate-errors-spki-list=${spki}`] : [];

// Browser processes get an in-repo HOME and TMPDIR so Chrome for Testing's preference plist
// (~/Library/Preferences/com.google.chrome.for.testing.plist) and scratch files stay inside the repo.
const browserHome = path.resolve(__dirname, '.tmp/home');
fs.mkdirSync(browserHome, { recursive: true });
export const browserEnv = { ...process.env, HOME: browserHome, TMPDIR: path.resolve(__dirname, '.tmp') };

export default defineConfig({
  testDir: './tests',
  timeout: 10 * 60 * 1000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    headless: true,
    launchOptions: {
      env: browserEnv,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${path.resolve(__dirname, 'fixtures/tone440.wav')}`,
        '--autoplay-policy=no-user-gesture-required',
        ...tlsArgs,
      ],
    },
  },
});
