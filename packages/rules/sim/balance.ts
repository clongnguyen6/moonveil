// Balance screen: node sim/balance.ts [matchesPerCell=1000] > report.md
// Runs bot matches for each player count, both policies, default deck and wolf±1 variants. Bots are not players.
import { DEFAULT_CONFIG, defaultDeck, validateDeck, type DeckCounts } from '../src/index.ts';
import { playMatch, type PolicyName } from './bots.ts';

export interface Cell {
  players: number;
  policy: PolicyName;
  deck: DeckCounts;
  n: number;
  village: number;
  wolves: number;
  draw: number;
  other: number;
  nightsMean: number;
  minutes: { p10: number; p50: number; p90: number };
}

export function runCell(players: number, policy: PolicyName, deck: DeckCounts, n: number, seedBase = 1): Cell {
  let village = 0, wolves = 0, draw = 0, other = 0, nights = 0;
  const mins: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = playMatch({ seed: seedBase * 1_000_003 + players * 10_007 + i, players, policy, deck });
    if (r.winner === 'village') village++;
    else if (r.winner === 'wolves') wolves++;
    else if (r.winner === 'draw') draw++;
    else other++;
    nights += r.nights;
    mins.push(r.seconds / 60);
  }
  mins.sort((a, b) => a - b);
  const q = (p: number) => mins[Math.min(mins.length - 1, Math.floor(p * mins.length))] as number;
  return { players, policy, deck, n, village, wolves, draw, other, nightsMean: nights / n, minutes: { p10: q(0.1), p50: q(0.5), p90: q(0.9) } };
}

/** Wilson 95% interval, in percent. */
export function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.round((c - h) * 100), Math.round((c + h) * 100)];
}

const pct = (k: number, n: number) => Math.round((k / n) * 100);
const deckStr = (d: DeckCounts) => `${d.wolf}W ${d.seer}S ${d.witch}Wi ${d.guard}G ${d.hunter}H ${d.villager}V`;

function variant(d: DeckCounts, dw: number): DeckCounts | null {
  const v = { ...d, wolf: d.wolf + dw, villager: d.villager - dw };
  return v.wolf >= 1 && v.villager >= 0 ? v : null;
}

if (import.meta.main) {
  const n = Number(process.argv[2] ?? 1000);
  const cfg = { ...DEFAULT_CONFIG, players: { min: 3, max: 30 } };
  console.log(`| Players | Deck | Policy | Village win % [95% CI] | Wolves % | Draw % | Nights (mean) | Minutes p10/p50/p90 | Flag |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  for (let players = 6; players <= 16; players++) {
    const base = defaultDeck(players, DEFAULT_CONFIG) as DeckCounts;
    for (const [label, deck] of [['default', base], ['wolf-1', variant(base, -1)], ['wolf+1', variant(base, +1)]] as const) {
      if (!deck || validateDeck(deck, players, cfg)) continue;
      for (const policy of ['heuristic', 'random'] as const) {
        if (label !== 'default' && policy === 'random') continue;
        const c = runCell(players, policy, deck, n);
        const [lo, hi] = wilson(c.village, c.n);
        const flag = policy === 'heuristic' && label === 'default' && (hi < 35 || lo > 65) ? 'LOPSIDED' : '';
        console.log(
          `| ${players} | ${label === 'default' ? '**' + deckStr(deck) + '**' : deckStr(deck)} | ${policy} | ${pct(c.village, c.n)} [${lo}–${hi}] | ${pct(c.wolves, c.n)} | ${pct(c.draw, c.n)} | ${c.nightsMean.toFixed(1)} | ${c.minutes.p10.toFixed(0)}/${c.minutes.p50.toFixed(0)}/${c.minutes.p90.toFixed(0)} | ${flag} |`,
        );
      }
    }
  }
}
