# moonveil

Web Werewolf for colleagues. Read `AGENTS.md` first. Architecture: `docs/architecture/0001-stack-and-authority.md`.

## Dev (Node >= 24.12, run from repo root)
All caches/tmp/browsers go to `.cache/` (gitignored) via `scripts/env.mjs`. Never install globally; don't run npm outside the root scripts.

    node scripts/env.mjs npm install
    npm run e2e:install      # Playwright chromium headless shell + webkit into .cache/ms-playwright
    # On macOS, Playwright WebKit also writes outside the repo (not redirectable): ~/Library/Preferences/org.webkit.Playwright.plist,
    # ~/Library/WebKit/org.webkit.Playwright/ and ~/Library/Caches/org.webkit.Playwright/. Every other cache stays in .cache/.
    # Run WebKit projects only where those writes are acceptable; label results "WebKit/browser emulation", not real devices.
    npm run dev              # server :4100 + vite :4101 -> http://127.0.0.1:4101
    npm run check            # typecheck + all workspace tests + e2e (OS-assigned free ports)
    E2E_SCALE=10,16 npm run e2e:scale   # opt-in N-browser runs; npm run bench = server fan-out cost
    npm run e2e:matches      # opt-in acceptance: 8 full real-engine matches, 7-10 browsers, both modes (docs/architecture/0006)
    npm run e2e:matches:voice   # same + real LiveKit (built in .cache/livekit) + voice wire assertions

Layout: `packages/protocol` (wire types), `apps/server` (authoritative rooms; rules engine STUB in `src/rules/`), `apps/web` (shell), `e2e/` (multi-session harness: `e2e/harness`).
Ports: 4100–4199 only.
