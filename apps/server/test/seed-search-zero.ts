// Search for the rare Q14 zero-survivors draw (run manually; prints the first hits per shape).
import { simulateAcceptance } from './match-driver.ts';
const N = Number(process.argv[2] ?? 2000);
for (const mode of ['automatic', 'moderator'] as const)
  for (const seats of [7, 8, 9, 10]) {
    const hits: string[] = [];
    for (let i = 0; i < N && hits.length < 2; i++) {
      const S = `${mode[0]}${seats}-${i}`;
      const r = simulateAcceptance(mode, seats, S);
      if (r.outcome?.reason === 'zeroSurvivors' && r.day <= seats + 3) hits.push(`${S}@d${r.day}`);
    }
    console.log(`${mode} ${seats} zeroSurvivors: ${hits.join(' ') || 'none in ' + N}`);
  }
