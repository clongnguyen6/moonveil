// Deterministic PRNG (mulberry32). State is a uint32 stored in MatchState.rng.

export function nextRandom(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: s };
}

/** Uniform integer in [0, n). */
export function nextInt(state: number, n: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * n), state: r.state };
}

export function shuffle<T>(items: readonly T[], state: number): { items: T[]; state: number } {
  const a = [...items];
  let s = state;
  for (let i = a.length - 1; i > 0; i--) {
    const r = nextInt(s, i + 1);
    s = r.state;
    const j = r.value;
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return { items: a, state: s };
}

/** Hash an arbitrary string seed to uint32 (FNV-1a). */
export function seedFrom(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
