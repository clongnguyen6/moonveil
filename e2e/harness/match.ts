// Full real-engine matches in browsers, driven at protocol level through each page's client handle
// (`window.__moonveil`, owned by foundation in client.ts), so it works before and after the game UI is wired.
// Bots read only their own wire view (me.actions) and send `act` over the page's real socket.
// When the UI lands, acceptance specs drive the same matches through UI selectors agreed with the UI owner.
import type { GameView, Mode, Profile, SeatView } from '@moonveil/protocol';
import { expect, type Player, type Table } from './index.ts';

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

export const game = (p: Player) => p.view().game as GameView | null;
export const stepKey = (v: SeatView) => {
  const g = v.game as GameView | null;
  return g ? `${g.night}/${g.day}/${g.step.kind}` : v.status;
};

// Protocol helpers through the page's client (no UI selectors).
export async function send(p: Player, msg: unknown) {
  await p.page.evaluate((m) => (globalThis as unknown as { __moonveil: { send(m: unknown): boolean } }).__moonveil.send(m), msg);
}
async function clientCall(p: Player, method: 'create' | 'join', args: unknown[]) {
  await p.page.evaluate(
    ([m, a]) => (globalThis as unknown as { __moonveil: Record<string, (...x: unknown[]) => void> }).__moonveil[m as string]!(...(a as unknown[])),
    [method, args] as const,
  );
}
const profile = (name: string): Profile => ({ name, appearance: { color: 'moss', hat: 'none' } });

// One random legal choice per available action, from this seat's own view.
export async function botAct(p: Player, r: () => number): Promise<number> {
  const me = game(p)?.me;
  if (!me || p.view().status !== 'playing') return 0;
  let n = 0;
  for (const a of me.actions) {
    let action: Record<string, unknown> | null = null;
    switch (a.type) {
      case 'wolf.pick':
      case 'guard.protect':
      case 'hunter.shoot':
        action = { type: a.type, target: a.targets.length && r() < 0.85 ? pick(r, a.targets) : 'pass' };
        break;
      case 'seer.inspect':
        if (a.targets.length) action = { type: a.type, target: pick(r, a.targets) };
        break;
      case 'witch.heal':
        if (a.canUse) action = { type: a.type, use: r() < 0.5 };
        break;
      case 'witch.poison':
        action = { type: a.type, target: a.targets.length && r() < 0.3 ? pick(r, a.targets) : 'pass' };
        break;
      case 'vote.nominate':
        action = { type: a.type, target: a.targets.length && r() < 0.8 ? pick(r, a.targets) : 'skip' };
        break;
      case 'vote.confirm':
        action = { type: a.type, choice: r() < 0.6 ? 'yes' : 'no' };
        break;
    }
    if (action) {
      await send(p, { t: 'act', action });
      n++;
    }
  }
  return n;
}

export interface BrowserMatch {
  mode: Mode;
  moderator: Player | null;
  players: Player[];
  driver: Player;
  steps: number;
}

// Create, join, ready, start: all via the client handle. `baseURL` = real-engine server.
export async function seatRealMatch(table: Table, opts: { mode: Mode; seats: number; baseURL: string }): Promise<BrowserMatch> {
  const ctx = { baseURL: opts.baseURL };
  const host = await table.player(opts.mode === 'moderator' ? 'Mod' : 'P0', ctx);
  await host.page.goto('/');
  await clientCall(host, 'create', [opts.mode, profile(host.name)]);
  await expect.poll(() => host.frames.some((f) => f.msg.t === 'welcome')).toBe(true);
  const code = host.view().code;
  const players: Player[] = opts.mode === 'automatic' ? [host] : [];
  while (players.length < opts.seats) {
    const p = await table.player(`P${players.length}`, ctx);
    await p.page.goto('/');
    await clientCall(p, 'join', [code, profile(p.name)]);
    players.push(p);
  }
  for (const p of players) await expect.poll(() => p.frames.some((f) => f.msg.t === 'welcome')).toBe(true);
  for (const p of players) await send(p, { t: 'ready', ready: true });
  await expect.poll(() => host.view().canStart).toBe(true);
  await send(host, { t: 'start' });
  for (const p of [host, ...players]) await expect.poll(() => p.view().status).toBe('playing');
  return { mode: opts.mode, moderator: opts.mode === 'moderator' ? host : null, players, driver: host, steps: 0 };
}

// Run to the end. Each step: every bot acts once, `onStep` runs (assertions), then the step closes
// (moderator: step.close; automatic: the server's accelerated timers).
export async function runRealMatch(m: BrowserMatch, seed: string, onStep?: (m: BrowserMatch) => Promise<void>, maxSteps = 200) {
  const r = rng(seed);
  for (; m.steps < maxSteps && m.driver.view().status === 'playing'; m.steps++) {
    const key = stepKey(m.driver.view());
    for (const p of m.players) await botAct(p, r);
    await onStep?.(m);
    if (m.moderator) await send(m.moderator, { t: 'act', action: { type: 'step.close' } });
    await expect.poll(() => m.driver.view().status !== 'playing' || stepKey(m.driver.view()) !== key, { timeout: 30_000 }).toBe(true);
    // Every seat agrees on the current step before anyone acts (steps may pass quickly at x20).
    await expect.poll(() => new Set([m.driver, ...m.players].map((p) => stepKey(p.view()))).size, { timeout: 10_000 }).toBe(1);
  }
}
