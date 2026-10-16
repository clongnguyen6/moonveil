// Search for the rare Q14 zero-survivors draw (run manually; prints the first hits per shape).
import { simulateAcceptance } from './match-driver.ts';
const N = Number(process.argv[2] ?? 2000);
const only = process.argv[3]; // e.g. 'automatic:9,automatic:10'
for (const mode of ['automatic', 'moderator'] as const)
  for (const seats of [7, 8, 9, 10]) {
    if (only && !only.split(',').includes(`${mode}:${seats}`)) continue;
    const hits: string[] = [];
    for (let i = 0; i < N && hits.length < 2; i++) {
      const S = `${mode[0]}${seats}-${i}`;
      await new Promise((res) => setImmediate(res)); // let voice-sync microtasks run (else memory backlog)
      const r = simulateAcceptance(mode, seats, S);
      if (r.outcome?.reason === 'zeroSurvivors' && r.day <= seats + 3) hits.push(`${S}@d${r.day}`);
    }
    console.log(`${mode} ${seats} zeroSurvivors: ${hits.join(' ') || 'none in ' + N}`);
  }
