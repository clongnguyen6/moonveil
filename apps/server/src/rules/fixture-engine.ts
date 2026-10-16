// FIXTURE engine, NOT Moonveil rules. Stands in for packages/rules until its API exists.
// Models only the information shapes the server must protect: a per-seat secret, a hidden group
// that knows its members, hidden targeted actions, and an end reveal. No Werewolf rules here.
import type { SeatId, VoiceGrant } from '@moonveil/protocol';
import type { PhaseInfo, Result, RulesEngine, Viewer } from './engine.ts';

export interface FixtureState {
  seats: SeatId[];
  secrets: Record<SeatId, string>;
  group: SeatId[];
  groupKey: string;
  phase: 'hidden' | 'open' | 'ended';
  round: number;
  marks: { by: SeatId; target: SeatId }[];
}

export interface FixtureOptions {
  rounds?: number;
  hiddenMs?: number;
  openMs?: number;
  maxPlayers?: number;
}

function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function nonce(r: () => number): string {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(r() * 36).toString(36);
  return s;
}

export function createFixtureEngine(opts: FixtureOptions = {}): RulesEngine<FixtureState> {
  const rounds = opts.rounds ?? 2;
  const hiddenMs = opts.hiddenMs ?? 30_000;
  const openMs = opts.openMs ?? 30_000;

  return {
    id: 'fixture',
    minPlayers: 3,
    maxPlayers: opts.maxPlayers ?? 20,

    setup({ seats, seed }) {
      const r = rng(seed);
      const order = [...seats];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      const groupSize = Math.max(1, Math.floor(seats.length / 3));
      const secrets: Record<SeatId, string> = {};
      for (const s of seats) secrets[s] = `secret-${nonce(r)}`;
      return {
        seats: [...seats],
        secrets,
        group: order.slice(0, groupSize),
        groupKey: `group-${nonce(r)}`,
        phase: 'hidden',
        round: 1,
        marks: [],
      };
    },

    phase(s): PhaseInfo {
      return {
        name: s.phase,
        secret: s.phase === 'hidden',
        durationMs: s.phase === 'hidden' ? hiddenMs : openMs,
        ended: s.phase === 'ended',
      };
    },

    submit(s, seat, action): Result<FixtureState> {
      const a = action as { kind?: unknown; target?: unknown } | null;
      if (s.phase !== 'hidden') return { ok: false, error: 'not now' };
      if (!s.group.includes(seat)) return { ok: false, error: 'not allowed' };
      if (!a || a.kind !== 'mark' || typeof a.target !== 'string' || !s.seats.includes(a.target)) {
        return { ok: false, error: 'bad action' };
      }
      const target = a.target;
      return { ok: true, state: { ...s, marks: [...s.marks.filter((m) => m.by !== seat), { by: seat, target }] } };
    },

    advance(s) {
      if (s.phase === 'hidden') return { ...s, phase: 'open', marks: [] };
      if (s.phase === 'open') {
        return s.round >= rounds ? { ...s, phase: 'ended' } : { ...s, phase: 'hidden', round: s.round + 1 };
      }
      return s;
    },

    view(s, viewer: Viewer) {
      const base = { engine: 'fixture', phase: s.phase, round: s.round };
      const all = () => s.seats.map((seat) => ({ seat, secret: s.secrets[seat], inGroup: s.group.includes(seat) }));
      if (viewer.kind === 'moderator') {
        return { ...base, reveal: all(), group: { key: s.groupKey, members: s.group, marks: s.marks } };
      }
      const me = viewer.seat;
      if (!s.seats.includes(me)) return base;
      const inGroup = s.group.includes(me);
      return {
        ...base,
        me: { secret: s.secrets[me], inGroup },
        ...(inGroup ? { group: { key: s.groupKey, members: s.group, marks: s.marks } } : {}),
        ...(s.phase === 'ended' ? { reveal: all() } : {}),
      };
    },

    channels(s, seat): VoiceGrant[] {
      if (s.phase === 'hidden') {
        return s.group.includes(seat) ? [{ channel: `group:${s.groupKey}`, listen: true, speak: true }] : [];
      }
      return [{ channel: 'public', listen: true, speak: true }];
    },
  };
}
