# moonveil

Web Werewolf for colleagues. Read `AGENTS.md` first. Architecture: `docs/architecture/0001-stack-and-authority.md`.

## Dev (Node >= 24.12, run from repo root)
All caches/tmp/browsers go to `.cache/` (gitignored) via `scripts/env.mjs`. Never install globally; don't run npm outside the root scripts.

    node scripts/env.mjs npm install
    npm run e2e:install      # Playwright chromium headless shell into .cache/ms-playwright
    # WebKit e2e is off: it writes to ~/Library on macOS (see e2e/playwright.config.ts).
    npm run dev              # server :4100 + vite :4101 -> http://127.0.0.1:4101
    npm run check            # typecheck + server tests + e2e (:4120, :4150)

Layout: `packages/protocol` (wire types), `apps/server` (authoritative rooms; rules engine STUB in `src/rules/`), `apps/web` (shell), `e2e/` (multi-session harness: `e2e/harness`).
Ports: 4100–4199 only.
