// Entry. Env: PORT (default 4100), HOST (default 127.0.0.1; 0.0.0.0 for LAN phones),
// STATIC_DIR (default apps/web/dist), MOONVEIL_FIXTURE_MS (fixture phase length, ms),
// MOONVEIL_ROOM_IDLE_MS (close rooms with no connection for this long; default 30 min),
// MOONVEIL_ENGINE (default real rules engine; `fixture` = test stub, used by browser e2e until the real-game UI exists),
// MOONVEIL_DATA_DIR (restart recovery, default <repo>/.data/rooms, gitignored; MOONVEIL_PERSIST=0 disables),
// MOONVEIL_TEST_TIME_SCALE (TESTS ONLY: server clock + timers run k× faster; rules and approved timings unchanged),
// LIVEKIT_URL + LIVEKIT_PUBLIC_WS + LIVEKIT_API_KEY + LIVEKIT_API_SECRET (all four = voice via LiveKit; none = no voice).
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RulesEngine } from './rules/engine.ts';
import { LiveKitBackend, LiveKitVoiceGateway } from '@moonveil/voice';
import { createHostedRulesEngine } from './rules/decks.ts';
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
    : createHostedRulesEngine()) as RulesEngine<unknown>;

// Test-only accelerated server time: the engine still sees 60 s nights, they just pass k× faster in wall time.
const timeScale = Number(process.env.MOONVEIL_TEST_TIME_SCALE ?? 1);
if (!(timeScale >= 1)) throw new Error('MOONVEIL_TEST_TIME_SCALE must be >= 1');
const t0 = Date.now();
const clock =
  timeScale === 1
    ? {}
    : {
        now: () => t0 + (Date.now() - t0) * timeScale,
        scheduler: {
          set: (ms: number, fn: () => void) => setTimeout(fn, ms / timeScale),
          clear: (h: unknown) => clearTimeout(h as NodeJS.Timeout),
        },
      };
if (timeScale !== 1) console.warn(`TEST TIME SCALE x${timeScale}: not for play`);

// Voice: all four LIVEKIT_* set = LiveKit gateway; none set = no voice (null gateway); partial = startup error.
const lk = ['LIVEKIT_URL', 'LIVEKIT_PUBLIC_WS', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].map((k) => process.env[k]);
if (lk.some(Boolean) && !lk.every(Boolean)) throw new Error('voice: set all of LIVEKIT_URL, LIVEKIT_PUBLIC_WS, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or none');
const [lkUrl, lkPublicWs, lkKey, lkSecret] = lk as [string, string, string, string];
const voice = lk.every(Boolean)
  ? new LiveKitVoiceGateway({
      backend: new LiveKitBackend(lkUrl, lkKey, lkSecret),
      keys: { apiKey: lkKey, apiSecret: lkSecret },
      publicWsUrl: lkPublicWs,
      autoCommit: false,
      onError: (room, err) => console.error(`voice ${room}:`, err),
    })
  : undefined;

const store =
  process.env.MOONVEIL_PERSIST === '0' ? undefined : fileRoomStore(process.env.MOONVEIL_DATA_DIR ?? join(here, '../../../.data/rooms'));

// Reachable LAN URLs, only when bound beyond loopback (HOST=0.0.0.0 or a LAN IP). http until TLS is chosen (ADR 0002).
const lanUrls = (): string[] => {
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return [];
  const addrs = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address);
  return (host === '0.0.0.0' ? addrs : addrs.filter((a) => a === host)).map((a) => `http://${a}:${port}`);
};

const { http, stop, registry } = createMoonveilServer({
  engine,
  ...(voice ? { voice } : {}),
  ...clock,
  lanUrls,
  ...(store ? { store } : {}),
  staticDir: process.env.STATIC_DIR ?? join(here, '../../web/dist'),
  ...(process.env.MOONVEIL_ROOM_IDLE_MS ? { idleMs: Number(process.env.MOONVEIL_ROOM_IDLE_MS) } : {}),
});

const restored = registry.restoreAll();
http.listen(port, host, () =>
  console.log(`moonveil server http://${host}:${port} engine=${engineKind} voice=${voice ? lkPublicWs : 'off'} restoredRooms=${restored}`),
);
for (const s of ['SIGINT', 'SIGTERM'] as const) {
  process.on(s, () => void stop().then(() => process.exit(0)));
}
