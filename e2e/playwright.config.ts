// Run via `npm run e2e` (root) so browsers/tmp live in .cache/. Port E2E_PORT (default 4150).
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4150);

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: '../.cache/e2e-results',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build -w @moonveil/web && node apps/server/src/main.ts',
    cwd: '..',
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Browser specs drive the fixture UI until the real-game UI (UI owner) lands.
    env: { PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'fixture', MOONVEIL_FIXTURE_MS: '6000' },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
    // Grant b (WORKSPACE_PROTOCOL.md): WebKit may write ONLY ~/Library/{Preferences/org.webkit.Playwright.plist,
    // WebKit/org.webkit.Playwright/, Caches/org.webkit.Playwright/}. Results = "WebKit/browser emulation", not iPhone.
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] }, testMatch: /mobile\.spec/ },
  ],
});
