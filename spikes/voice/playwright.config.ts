import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// All browser binaries live in ./.browsers (gitignored); see .npmrc / README.
process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(__dirname, '.browsers');

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
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${path.resolve(__dirname, 'fixtures/tone440.wav')}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
});
