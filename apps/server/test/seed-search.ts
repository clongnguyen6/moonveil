// Seed search for the acceptance suites (run manually: node scripts/env.mjs node apps/server/test/seed-search.ts [N]).
// Prints, per mode and seat count, the first seeds reaching each end path, within seats + 3 days.
import { simulateAcceptance } from './match-driver.ts';

const N = Number(process.argv[2] ?? 300);
const found: Record<string, string[]> = {};
for (const mode of ['automatic', 'moderator'] as const) {
  for (const seats of [7, 8, 9, 10]) {
    for (let i = 0; i < N; i++) {
      const S = `${mode[0]}${seats}-${i}`;
      await new Promise((res) => setImmediate(res)); // let voice-sync microtasks run (else memory backlog)
      const r = simulateAcceptance(mode, seats, S);
      if (!r.outcome || r.day > seats + 3) continue;
      const key = `${mode} ${seats} ${r.outcome.winner}/${r.outcome.reason}`;
      (found[key] ??= []).length < 3 && found[key]!.push(`${S}@d${r.day}`);
    }
  }
}
for (const [k, v] of Object.entries(found).sort()) console.log(k.padEnd(40), v.join(' '));
