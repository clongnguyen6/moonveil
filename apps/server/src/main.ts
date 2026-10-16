// Entry. Env: PORT (default 4100), HOST (default 127.0.0.1; 0.0.0.0 for LAN phones),
// STATIC_DIR (default apps/web/dist), MOONVEIL_FIXTURE_MS (fixture phase length, ms),
// MOONVEIL_ROOM_IDLE_MS (close rooms with no connection for this long; default 30 min).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixtureEngine } from './rules/fixture-engine.ts';
import { createMoonveilServer } from './server.ts';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4100);
const host = process.env.HOST ?? '127.0.0.1';
if (port < 4100 || port > 4199) console.warn(`port ${port} is outside Moonveil's 4100-4199 range`);
const phaseMs = process.env.MOONVEIL_FIXTURE_MS ? Number(process.env.MOONVEIL_FIXTURE_MS) : undefined;

const { http, stop } = createMoonveilServer({
  // STUB until packages/rules publishes its API.
  engine: () => createFixtureEngine({ hiddenMs: phaseMs, openMs: phaseMs }),
  staticDir: process.env.STATIC_DIR ?? join(here, '../../web/dist'),
  ...(process.env.MOONVEIL_ROOM_IDLE_MS ? { idleMs: Number(process.env.MOONVEIL_ROOM_IDLE_MS) } : {}),
});

http.listen(port, host, () => console.log(`moonveil server http://${host}:${port}`));
for (const s of ['SIGINT', 'SIGTERM'] as const) {
  process.on(s, () => void stop().then(() => process.exit(0)));
}
