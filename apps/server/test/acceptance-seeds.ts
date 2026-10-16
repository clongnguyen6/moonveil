// Fixed acceptance seeds: one per (mode, seats), chosen with seed-search.ts so the acceptance suites cover every
// reachable end path deterministically. S = host name (server seed `e2e:<S>` via MOONVEIL_TEST_SEED) = bot rng seed.
// Validated in-process by acceptance-seeds.test.ts; browser suites assert the same outcomes.
export interface AcceptanceSeed {
  mode: 'automatic' | 'moderator';
  seats: number;
  S: string;
  expect: { winner: string; reason: string };
}

export const ACCEPTANCE_SEEDS: AcceptanceSeed[] = [
  { mode: 'automatic', seats: 7, S: 'a7-0', expect: { winner: 'wolves', reason: 'parity' } },
  { mode: 'automatic', seats: 8, S: 'a8-6', expect: { winner: 'village', reason: 'noWolves' } },
  { mode: 'automatic', seats: 9, S: 'a9-3', expect: { winner: 'wolves', reason: 'parity' } },
  { mode: 'automatic', seats: 10, S: 'a10-16', expect: { winner: 'draw', reason: 'stalemate' } },
  { mode: 'moderator', seats: 7, S: 'm7-2', expect: { winner: 'village', reason: 'noWolves' } },
  { mode: 'moderator', seats: 8, S: 'm8-3', expect: { winner: 'wolves', reason: 'parity' } },
  { mode: 'moderator', seats: 9, S: 'm9-54', expect: { winner: 'draw', reason: 'stalemate' } },
  { mode: 'moderator', seats: 10, S: 'm10-39', expect: { winner: 'village', reason: 'noWolves' } },
];

// Extra matches for paths the 7-10 grid doesn't hit (seed-search-zero.ts): Q14 zero survivors, one per mode.
export const EXTRA_SEEDS: AcceptanceSeed[] = [
  { mode: 'automatic', seats: 9, S: 'a9-1025', expect: { winner: 'draw', reason: 'zeroSurvivors' } },
  { mode: 'moderator', seats: 7, S: 'm7-1124', expect: { winner: 'draw', reason: 'zeroSurvivors' } },
];

// Every acceptance match: the grid (one per mode x 7-10 seats) plus the extras.
export const ALL_ACCEPTANCE: AcceptanceSeed[] = [...ACCEPTANCE_SEEDS, ...EXTRA_SEEDS];

export const seedFor = (mode: string, seats: number) => {
  const s = ACCEPTANCE_SEEDS.find((x) => x.mode === mode && x.seats === seats);
  if (!s) throw new Error(`no acceptance seed for ${mode} ${seats}`);
  return s;
};

// End paths every acceptance suite covers per mode.
export const REQUIRED_PATHS = ['wolves/parity', 'village/noWolves', 'draw/stalemate', 'draw/zeroSurvivors'];
