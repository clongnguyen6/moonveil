// Balance screen (PROVISIONAL tooling): node sim/balance.ts [matchesPerCell=1000] > out.md
// Bots are not players. This only screens for obviously broken setups (Q17/Q18).
import { DEFAULT_CONFIG, defaultDeck, validateDeck, type DeckCounts } from '../src/index.ts';
import { type Knobs, playMatch, type PolicyName, SMART_VILLAGE } from './bots.ts';

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
  /** Share of executions that hit a wolf. */
  execAccuracy: number;
}

export function runCell(players: number, policy: PolicyName, deck: DeckCounts, n: number, knobs: Partial<Knobs> = {}, seedBase = 1): Cell {
  let village = 0, wolves = 0, draw = 0, other = 0, nights = 0, ew = 0, ev = 0;
  const mins: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = playMatch({ seed: seedBase * 1_000_003 + players * 10_007 + i, players, policy, deck, knobs });
    if (r.winner === 'village') village++;
    else if (r.winner === 'wolves') wolves++;
    else if (r.winner === 'draw') draw++;
    else other++;
    nights += r.nights;
    ew += r.executions.wolf;
    ev += r.executions.village;
    mins.push(r.seconds / 60);
  }
  mins.sort((a, b) => a - b);
  const q = (p: number) => mins[Math.min(mins.length - 1, Math.floor(p * mins.length))] as number;
  return {
    players, policy, deck, n, village, wolves, draw, other,
    nightsMean: nights / n,
    minutes: { p10: q(0.1), p50: q(0.5), p90: q(0.9) },
    execAccuracy: ew + ev ? ew / (ew + ev) : 0,
  };
}

/** Wilson 95% interval, in percent. */
export function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.round((c - h) * 100), Math.round((c + h) * 100)];
}

export const deckStr = (d: DeckCounts) => `${d.wolf}W ${d.seer}S ${d.witch}Wi ${d.guard}G ${d.hunter}H ${d.villager}V`;
const pct = (k: number, n: number) => Math.round((k / n) * 100);

export function variant(d: DeckCounts, dw: number): DeckCounts | null {
  const v = { ...d, wolf: d.wolf + dw, villager: d.villager - dw };
  return v.wolf >= 1 && v.villager >= 0 ? v : null;
}

export function row(c: Cell, label: string, flag = ''): string {
  const [lo, hi] = wilson(c.village, c.n);
  return `| ${c.players} | ${label} | ${c.policy} | ${pct(c.village, c.n)} [${lo}–${hi}] | ${pct(c.wolves, c.n)} | ${pct(c.draw, c.n)} | ${Math.round(c.execAccuracy * 100)} | ${c.nightsMean.toFixed(1)} | ${c.minutes.p10.toFixed(0)}/${c.minutes.p50.toFixed(0)}/${c.minutes.p90.toFixed(0)} | ${flag} |`;
}

/** `node sim/balance.ts <n> smart`: default vs smarter-village bots at 10-15 players, current table vs one wolf fewer. */
function smartReport(n: number): void {
  const head = `| Players | Deck | Village bots | Village win % [95% CI] | Wolves % | Exec. hit wolf % | Nights | Minutes p50 |\n|---|---|---|---|---|---|---|---|`;
  console.log(`### Smarter-village sensitivity (heuristic, n=${n} per row)\n\n${head}`);
  for (let players = 10; players <= 15; players++) {
    const base = defaultDeck(players, DEFAULT_CONFIG) as DeckCounts;
    for (const deck of [base, variant(base, -1)!]) {
      for (const [label, knobs] of [['default', {}], ['smart', SMART_VILLAGE]] as const) {
        const c = runCell(players, 'heuristic', deck, n, knobs);
        const [lo, hi] = wilson(c.village, c.n);
        console.log(`| ${players} | ${deckStr(deck)} | ${label} | ${pct(c.village, c.n)} [${lo}–${hi}] | ${pct(c.wolves, c.n)} | ${Math.round(c.execAccuracy * 100)} | ${c.nightsMean.toFixed(1)} | ${c.minutes.p50.toFixed(0)} |`);
      }
    }
  }
}

if (import.meta.main && process.argv[3] === 'smart') {
  smartReport(Number(process.argv[2] ?? 1000));
} else if (import.meta.main) {
  const n = Number(process.argv[2] ?? 1000);
  const cfg = DEFAULT_CONFIG;
  const head = `| Players | Deck | Policy | Village win % [95% CI] | Wolves % | Draw % | Exec. hit wolf % | Nights | Minutes p10/p50/p90 | Flag |\n|---|---|---|---|---|---|---|---|---|---|`;
  console.log(`### Recommended decks and wolf±1 variants (n=${n} per row)\n\n${head}`);
  for (let players = 7; players <= 15; players++) {
    const base = defaultDeck(players) as DeckCounts;
    for (const [label, deck] of [['default', base], ['wolf-1', variant(base, -1)], ['wolf+1', variant(base, +1)]] as const) {
      if (!deck) continue;
      const invalid = validateDeck(deck, players, cfg);
      if (invalid) {
        console.log(`| ${players} | ${deckStr(deck)} | — | rejected by deck check: ${invalid} | | | | | | |`);
        continue;
      }
      for (const policy of ['heuristic', 'random'] as const) {
        if (label !== 'default' && policy === 'random') continue;
        const c = runCell(players, policy, deck, n);
        const [lo, hi] = wilson(c.village, c.n);
        const flag = policy === 'heuristic' && (hi < 35 || lo > 65) ? 'LOPSIDED' : '';
        console.log(row(c, label === 'default' ? `**${deckStr(deck)}**` : deckStr(deck), flag));
      }
    }
  }
  console.log(`\n### Sensitivity of the recommended decks to the social-read assumption (heuristic, n=${Math.round(n / 2)})\n\n${head}`);
  for (const players of [7, 8, 9, 10, 12, 13, 15]) {
    const deck = defaultDeck(players) as DeckCounts;
    for (const w of [1.0, 2.5]) {
      console.log(row(runCell(players, 'heuristic', deck, Math.round(n / 2), { wolfSuspicionWeight: w }, 7), `read=${w}`));
    }
    console.log(row(runCell(players, 'heuristic', deck, Math.round(n / 2), { bandwagon: 0.2 }, 7), 'bandwagon=0.2'));
    console.log(row(runCell(players, 'heuristic', deck, Math.round(n / 2), { followLiveVotes: 0 }, 7), 'followLive=0'));
  }
}
