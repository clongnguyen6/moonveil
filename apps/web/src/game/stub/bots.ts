// Random legal action for a seat, from its own projection only (bots see what a player sees).
import type { HostView } from '@moonveil/rules';

const pick = <T,>(xs: readonly T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

export function pickBotAction(v: HostView): Record<string, unknown> | null {
  const me = v.me;
  if (!me) return null;
  for (const a of me.actions) {
    switch (a.type) {
      case 'wolf.pick': {
        if (a.current !== null) return null;
        const agreed = v.pack?.picks?.find((p) => p !== null && p !== 'pass');
        const t = agreed ?? pick(a.targets);
        return t === undefined ? null : { type: 'wolf.pick', target: t };
      }
      case 'seer.inspect': {
        const t = pick(a.targets);
        return t === undefined ? null : { type: 'seer.inspect', target: t };
      }
      case 'guard.protect': {
        if (a.current !== null) return null;
        const t = pick(a.targets);
        return t === undefined ? null : { type: 'guard.protect', target: t };
      }
      case 'witch.heal':
        if (a.current !== null) continue;
        return { type: 'witch.heal', use: a.canUse && Math.random() < 0.5 };
      case 'witch.poison':
        if (a.current !== null) continue;
        return { type: 'witch.poison', target: Math.random() < 0.8 ? 'pass' : (pick(a.targets) ?? 'pass') };
      case 'vote.nominate': {
        if (a.current !== null) return null;
        const t = Math.random() < 0.2 ? 'skip' : pick(a.targets);
        return t === undefined ? null : { type: 'vote.nominate', target: t };
      }
      case 'vote.confirm':
        if (a.current !== null) return null;
        return { type: 'vote.confirm', choice: Math.random() < 0.6 ? 'yes' : 'no' };
      case 'hunter.shoot': {
        if (a.current !== null) return null;
        const t = pick(a.targets);
        return t === undefined ? null : { type: 'hunter.shoot', target: t };
      }
    }
  }
  return null;
}
