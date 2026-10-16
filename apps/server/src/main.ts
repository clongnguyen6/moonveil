// Entry. Env: PORT (default 4100), HOST (default 127.0.0.1; 0.0.0.0 for LAN phones),
// STATIC_DIR (default apps/web/dist), MOONVEIL_FIXTURE_MS (fixture phase length, ms),
// MOONVEIL_ROOM_IDLE_MS (close rooms with no connection for this long; default 30 min),
// MOONVEIL_ENGINE (default real rules engine; `fixture` = test stub, used by browser e2e until the real-game UI exists),
// MOONVEIL_DATA_DIR (restart recovery, default <repo>/.data/rooms, gitignored; MOONVEIL_PERSIST=0 disables).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from './rules/engine.ts';
import { createFixtureEngine } from './rules/fixture-engine.ts';
import { fileRoomStore } from './store.ts';
import { createMoonveilServer } from './server.ts';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4100);
const host = process.env.HOST ?? '127.0.0.1';
if (port < 4100 || port > 4199) console.warn(`port ${port} is outside Moonveil's 4100-4199 range`);
const phaseMs = process.env.MOONVEIL_FIXTURE_MS ? Number(process.env.MOONVEIL_FIXTURE_MS) : undefined;

const engineKind = process.env.MOONVEIL_ENGINE ?? 'rules';
if (engineKind !== 'rules' && engineKind !== 'fixture') throw new Error(`MOONVEIL_ENGINE must be rules|fixture, got ${engineKind}`);
const engine = (): RulesEngine<unknown> =>
  (engineKind === 'fixture'
    ? createFixtureEngine({ hiddenMs: phaseMs, openMs: phaseMs })
    : createRulesEngine()) as RulesEngine<unknown>;

const store =
  process.env.MOONVEIL_PERSIST === '0' ? undefined : fileRoomStore(process.env.MOONVEIL_DATA_DIR ?? join(here, '../../../.data/rooms'));

const { http, stop, registry } = createMoonveilServer({
  engine,
  ...(store ? { store } : {}),
  staticDir: process.env.STATIC_DIR ?? join(here, '../../web/dist'),
  ...(process.env.MOONVEIL_ROOM_IDLE_MS ? { idleMs: Number(process.env.MOONVEIL_ROOM_IDLE_MS) } : {}),
});

const restored = registry.restoreAll();
http.listen(port, host, () => console.log(`moonveil server http://${host}:${port} engine=${engineKind} restoredRooms=${restored}`));
for (const s of ['SIGINT', 'SIGTERM'] as const) {
  process.on(s, () => void stop().then(() => process.exit(0)));
}
