// Run via `npm run e2e` (root): browsers/tmp live in .cache/, and scripts/e2e-run.mjs picks free OS ports
// (E2E_PORT for the web server, E2E_RESTART_PORT for restart tests) unless already set.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4150); // fallback only for direct `playwright test`

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
