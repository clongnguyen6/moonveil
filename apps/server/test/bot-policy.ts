// One bot policy for every driver (server-level scripted clients, browser protocol actor, browser UI actor).
// Pure: a seat's own view + a seeded rng -> intended actions. Identical choices everywhere, so a strict browser match
// (every intended action lands) plays out exactly like its server-level simulation; seeds can be chosen in-process.
import type { GameView } from '@moonveil/protocol';

export function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

// value: seat index, 'skip' (nominate), 'yes'/'no' (confirm), true/false (heal). 'pass' = submit nothing.
export interface Plan {
  type: string;
  value: number | 'skip' | 'yes' | 'no' | boolean;
}

export function planActions(g: GameView | null, r: () => number): Plan[] {
  const me = g?.me;
  if (!me) return [];
  const out: Plan[] = [];
  for (const a of me.actions) {
    switch (a.type) {
      case 'wolf.pick':
      case 'guard.protect':
      case 'hunter.shoot':
        if (a.targets.length && r() < 0.85) out.push({ type: a.type, value: pick(r, a.targets) });
        break;
      case 'seer.inspect':
        if (a.targets.length) out.push({ type: a.type, value: pick(r, a.targets) });
        break;
      case 'witch.heal':
        if (a.canUse) out.push({ type: a.type, value: r() < 0.5 });
        break;
      case 'witch.poison':
        if (a.targets.length && r() < 0.3) out.push({ type: a.type, value: pick(r, a.targets) });
        break;
      case 'vote.nominate':
        out.push({ type: a.type, value: a.targets.length && r() < 0.8 ? pick(r, a.targets) : 'skip' });
        break;
      case 'vote.confirm':
        out.push({ type: a.type, value: r() < 0.6 ? 'yes' : 'no' });
        break;
    }
  }
  return out;
}

// Protocol `act` payload for a plan.
export function toAction(p: Plan): Record<string, unknown> {
  switch (p.type) {
    case 'witch.heal':
      return { type: p.type, use: p.value };
    case 'vote.confirm':
      return { type: p.type, choice: p.value };
    default:
      return { type: p.type, target: p.value };
  }
}
