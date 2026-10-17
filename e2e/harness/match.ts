// Full real-engine matches in browsers, driven at protocol level through each page's client handle
// (`window.__moonveil`, owned by foundation in client.ts), so it works before and after the game UI is wired.
// Bots read only their own wire view (me.actions) and send `act` over the page's real socket.
// When the UI lands, acceptance specs drive the same matches through UI selectors agreed with the UI owner.
import type { GameView, Mode, Profile, SeatView } from '@moonveil/protocol';
import { planActions, rng, toAction } from '../../apps/server/test/bot-policy.ts';
import { expect, type Player, type Table } from './index.ts';
import { quietUi, type SceneMode } from './ui.ts';

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

// Shared bot policy (apps/server/test/bot-policy.ts) over the page's real socket.
export async function botAct(p: Player, r: () => number): Promise<number> {
  if (p.view().status !== 'playing') return 0;
  const plans = planActions(game(p), r);
  for (const plan of plans) await send(p, { t: 'act', action: toAction(plan) });
  return plans.length;
}

export interface BrowserMatch {
  mode: Mode;
  moderator: Player | null;
  players: Player[];
  driver: Player;
  steps: number;
  // Step keys the loop acted in (one iteration each). See skippedSteps.
  acted: Set<string>;
}

// Create, join, ready, start: all via the client handle. `baseURL` = real-engine server.
// hostName: with MOONVEIL_TEST_SEED the server's match seed is `<base>:<host name>` (acceptance seeds).
export async function seatRealMatch(table: Table, opts: { mode: Mode; seats: number; baseURL: string; hostName?: string; scene: SceneMode }): Promise<BrowserMatch> {
  const ctx = { baseURL: opts.baseURL };
  const host = await table.player(opts.hostName ?? (opts.mode === 'moderator' ? 'Mod' : 'P0'), ctx);
  // Game UI is mounted on every page: documented quiet settings for many-context runs (SELECTORS.md); scene per opts.
  await quietUi(host, opts.scene);
  await host.page.goto('/');
  await clientCall(host, 'create', [opts.mode, profile(host.name)]);
  // The room code is read from the first state frame (welcome may arrive alone first).
  await expect.poll(() => host.frames.some((f) => f.msg.t === 'state')).toBe(true);
  const code = host.view().code;
  const players: Player[] = opts.mode === 'automatic' ? [host] : [];
  while (players.length < opts.seats) {
    const p = await table.player(`P${players.length}`, ctx);
    await quietUi(p, opts.scene);
    await p.page.goto('/');
    await clientCall(p, 'join', [code, profile(p.name)]);
    players.push(p);
  }
  for (const p of players) await expect.poll(() => p.frames.some((f) => f.msg.t === 'state')).toBe(true);
  for (const p of players) await send(p, { t: 'ready', ready: true });
  await expect.poll(() => host.view().canStart).toBe(true);
  await send(host, { t: 'start' });
  for (const p of [host, ...players]) await expect.poll(() => p.view().status).toBe('playing');
  return { mode: opts.mode, moderator: opts.mode === 'moderator' ? host : null, players, driver: host, steps: 0, acted: new Set() };
}

// Run to the end. Each step: every bot acts once, `onStep` runs (assertions), then the step closes
// (moderator: step.close; automatic: the server's accelerated timers).
export interface Actor {
  act(p: Player, r: () => number): Promise<number>;
  close(mod: Player): Promise<void>;
}
export const protocolActor: Actor = {
  act: botAct,
  close: (mod) => send(mod, { t: 'act', action: { type: 'step.close' } }),
};

// Public-log summary for failure reports (what happened each night/day).
export function matchDiag(m: BrowserMatch): string {
  const g = game(m.driver);
  const log = (g?.publicLog ?? []).flatMap((e) => {
    const x = e as { t: string; night?: number; day?: number; dead?: number[]; accused?: number | null; executed?: boolean; seat?: number };
    if (x.t === 'dawn') return [`N${x.night}: dead=[${x.dead?.join(',') ?? ''}]`];
    if (x.t === 'nomination') return [`D${x.day}: accused=${x.accused ?? 'none'}`];
    if (x.t === 'confirm') return [`D${x.day}: executed=${x.executed}`];
    if (x.t === 'shot') return [`shot`];
    return [];
  });
  return JSON.stringify({ room: m.driver.view().code, day: g?.day, night: g?.night, step: g?.step.kind, log });
}

export async function runRealMatch(
  m: BrowserMatch,
  seed: string,
  onStep?: (m: BrowserMatch) => Promise<void>,
  maxSteps = 200,
  actor: Actor = protocolActor,
  maxDays = Infinity,
) {
  const r = rng(seed);
  for (; m.steps < maxSteps && m.driver.view().status === 'playing'; m.steps++) {
    const day = game(m.driver)?.day ?? 0;
    // Acceptance: a match must reach a win condition within a bounded number of days.
    if (day > maxDays) throw new Error(`no win condition by day ${maxDays}: ${matchDiag(m)}`);
    const key = stepKey(m.driver.view());
    m.acted.add(key);
    for (const p of m.players) await actor.act(p, r);
    await onStep?.(m);
    if (m.moderator) await actor.close(m.moderator);
    // A step can last minutes of wall time at low time scales (e.g. discussion 60 s + 15 s per living seat).
    // Views are local (captured frames), so tight polling is cheap; it narrows the window for a step to pass unseen.
    await expect.poll(() => m.driver.view().status !== 'playing' || stepKey(m.driver.view()) !== key, { timeout: 240_000, intervals: [20] }).toBe(true);
    // Every seat agrees on the current step before anyone acts (steps may pass quickly at x20).
    await expect.poll(() => new Set([m.driver, ...m.players].map((p) => stepKey(p.view()))).size, { timeout: 10_000, intervals: [20] }).toBe(1);
  }
}

// Steps the driver's socket saw while playing that the loop never acted in: they passed between two iterations
// (pacing), so no bot acted and later bot choices diverge from the in-process simulation. withActions = some seat's
// own view offered actions in that step. Key collisions (same night/day/kind twice) are merged, so this can only
// under-count.
export function skippedSteps(m: BrowserMatch): { key: string; withActions: boolean }[] {
  const seen = new Set<string>();
  for (const f of m.driver.frames) if (f.msg.t === 'state' && f.msg.view.status === 'playing') seen.add(stepKey(f.msg.view));
  return [...seen]
    .filter((k) => !m.acted.has(k))
    .map((key) => ({
      key,
      withActions: [...m.players, ...(m.moderator ? [m.moderator] : [])].some((p) =>
        p.frames.some((f) => f.msg.t === 'state' && stepKey(f.msg.view) === key && ((f.msg.view.game as GameView | null)?.me?.actions.length ?? 0) > 0),
      ),
    }));
}

// D2: voice connects only after an explicit join. Checks that nothing connected before it, then joins every page
// (not awaited in the page: a mic request may wait on the browser; voiceJoined is set synchronously).
type VoiceHandle = { __moonveil: { joinVoice(): Promise<void>; state: { voiceJoined: boolean }; voice: { getSnapshot(): { joined: boolean; channels: Record<string, unknown> } } | null } };
export async function joinVoiceAll(m: BrowserMatch) {
  for (const p of [...m.players, ...(m.moderator ? [m.moderator] : [])]) {
    const before = await p.page.evaluate(() => {
      const v = (globalThis as unknown as VoiceHandle).__moonveil.voice?.getSnapshot();
      return v ? { joined: v.joined, channels: Object.keys(v.channels).length } : null;
    });
    expect(before === null || (!before.joined && before.channels === 0), `${p.name}: voice connected before join: ${JSON.stringify(before)}`).toBe(true);
    await p.page.evaluate(() => void (globalThis as unknown as VoiceHandle).__moonveil.joinVoice());
    await expect.poll(() => p.page.evaluate(() => (globalThis as unknown as VoiceHandle).__moonveil.state.voiceJoined)).toBe(true);
  }
}

