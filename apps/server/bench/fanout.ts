// Server fan-out cost per state change vs room size (in-process, FIXTURE engine, real JSON encoding).
// Run: node scripts/env.mjs node apps/server/bench/fanout.ts
import type { ServerMessage } from '@moonveil/protocol';
import { type Conn, realScheduler } from '../src/room.ts';
import { Registry, Session } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine } from '../src/rules/fixture-engine.ts';

function run(n: number, reps: number) {
  const registry = new Registry({
    engine: () => createFixtureEngine({ maxPlayers: n, hiddenMs: 1e9, openMs: 1e9 }) as RulesEngine<unknown>,
    scheduler: realScheduler,
  });
  let bytes = 0;
  let frames = 0;
  let code = '';
  const sessions: Session[] = [];
  const mk = () => {
    const conn: Conn = {
      send: (m: ServerMessage) => {
        if (m.t === 'welcome') code = m.code;
        const s = JSON.stringify(m);
        bytes += s.length;
        frames++;
      },
      close: () => {},
    };
    const s = new Session(registry, conn);
    sessions.push(s);
    return s;
  };
  const app = { color: 'moss', hat: 'none' } as const;
  const host = mk();
  host.receive({ t: 'create', mode: 'automatic', profile: { name: 'P0', appearance: app } });
  for (let i = 1; i < n; i++) mk().receive({ t: 'join', code, profile: { name: `P${i}`, appearance: app } });
  // Public change: one player toggles ready -> every seat's view changes.
  const toggler = sessions[1]!;
  bytes = frames = 0;
  const t0 = performance.now();
  for (let r = 0; r < reps; r++) toggler.receive({ t: 'ready', ready: r % 2 === 0 });
  const ms = (performance.now() - t0) / reps;
  const out = { n, msPerPublicChange: +ms.toFixed(3), framesPerChange: frames / reps, bytesPerFrame: Math.round(bytes / frames), bytesPerChange: Math.round(bytes / reps) };
  return out;
}

run(16, 50); // warm-up
for (const n of [10, 16, 32, 64, 128, 256, 512]) console.log(JSON.stringify(run(n, n >= 256 ? 5 : 30)));
process.exit(0);
