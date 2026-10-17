// Helpers for the voice full-match suite. Reuses foundation's e2e harness (public helpers only) and reads
// voice state through the page's VoiceClient, which the web shell is expected to expose as
// `globalThis.__moonveil.voice` once foundation's wiring lands (ADR 0004).
import { expect, type Player } from '../../../e2e/harness/index.ts';
import type { GameView, SeatView, VoiceGrant } from '@moonveil/protocol';
import type { AudioStats, VoiceSnapshot } from '../src/client.ts';

export const ENERGY_MIN = 0.004; // totalAudioEnergy growth over 2 s; a -12 dBFS tone yields ~0.06, silence 0
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const game = (p: Player): GameView | null => (p.view().engine === 'moonveil-werewolf' ? (p.view().game as GameView) : null);
export const step = (p: Player): string => game(p)?.step.kind ?? p.view().status;
export const grants = (p: Player): VoiceGrant[] => p.view().voice;
export const grant = (v: SeatView, channel: string): VoiceGrant | undefined => v.voice.find((g) => g.channel === channel);

// ---- voice state in the page ----

// page.evaluate has no timeout: a frozen renderer (CPU starvation, a hung getStats) would hang the test
// until its global timeout and leave no evidence. Bound every evaluate and name the page in the error.
export class PageUnresponsive extends Error {
  constructor(name: string, what: string, ms: number) {
    super(`${name}: page unresponsive, ${what} did not return within ${ms} ms`);
  }
}
async function evalBounded<T>(p: Player, what: string, fn: () => T | Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p.page.evaluate(fn), new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new PageUnresponsive(p.name, what, ms)), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}
export async function voiceSnapshot(p: Player): Promise<VoiceSnapshot | null> {
  return evalBounded(p, 'voiceSnapshot', () => {
    const v = (globalThis as any).__moonveil?.voice;
    return v && typeof v.getSnapshot === 'function' ? (v.getSnapshot() as VoiceSnapshot) : null;
  });
}
export async function voiceStats(p: Player): Promise<AudioStats[]> {
  return evalBounded(p, 'voiceStats', async () => {
    const v = (globalThis as any).__moonveil?.voice;
    return v && typeof v.stats === 'function' ? ((await v.stats()) as AudioStats[]) : [];
  });
}
// The web client creates its VoiceClient lazily on the first non-empty `voice` message (dynamic import).
export async function requireVoiceWiring(p: Player) {
  await expect
    .poll(async () => (await voiceSnapshot(p)) !== null, { message: 'voice wiring missing: the web shell must expose its VoiceClient as globalThis.__moonveil.voice', timeout: 20_000 })
    .toBe(true);
}

// D2: voice connects only after an explicit join() from a user gesture; the UI makes that call from the
// "join campfire" tap. The suite makes it directly on each page once the VoiceClient exists.
export async function joinVoice(players: Player[]) {
  for (const p of players) {
    await requireVoiceWiring(p);
    await evalBounded(p, 'voice.join', () => (globalThis as any).__moonveil.voice.join());
  }
}

// Wait until every player's voice channels match its grants (names) and are connected.
export async function voiceSettled(players: Player[], timeout = 40_000) {
  const t0 = Date.now();
  for (const p of players) {
    let lastLogged = 0;
    await expect
      .poll(
        async () => {
          const snap = await voiceSnapshot(p);
          let state = 'ok';
          if (!snap) state = 'no voice client';
          else {
            const want = grants(p).filter((g) => g.listen || g.speak).map((g) => g.channel).sort().join();
            const have = Object.keys(snap.channels).sort().join();
            if (want !== have) state = `channels [${have}] != grants [${want}]`;
            else for (const [name, c] of Object.entries(snap.channels)) if (c.state !== 'connected') state = `${name}: ${c.state} ${c.error ?? ''}`;
          }
          // Evidence trail: what this page is waiting on, every 10 s while not settled.
          if (state !== 'ok' && Date.now() - lastLogged > 10_000) {
            lastLogged = Date.now();
            console.log(`  settle ${p.name} +${((Date.now() - t0) / 1000).toFixed(0)}s: ${state}; step=${step(p)}; channels=${snap ? Object.entries(snap.channels).map(([k, c]) => `${k}:${c.state}${c.publishing ? '/pub' : ''}`).join(',') : '-'}; mic=${snap?.mic ?? '-'}`);
          }
          return state;
        },
        { message: `${p.name}: voice settle`, timeout },
      )
      .toBe('ok');
  }
  // Publishing must have started where speak is granted and the mic works; then wait (bounded) until every
  // listener has a subscribed track from every expected speaker, so the window measures routing, not setup.
  for (const p of players) {
    await expect
      .poll(async () => {
        const snap = await voiceSnapshot(p);
        if (!snap) return 'no voice client';
        for (const [name, c] of Object.entries(snap.channels)) if (c.speak && snap.mic === 'granted' && !snap.muted && !c.publishing) return `${name}: not publishing yet`;
        return 'ok';
      }, { message: `${p.name}: publishing`, timeout })
      .toBe('ok');
  }
  const deadline = Date.now() + 15_000;
  for (;;) {
    const missing: string[] = [];
    for (const a of players) {
      const sa = await voiceSnapshot(a);
      const stats = await voiceStats(a);
      for (const g of grants(a)) {
        if (!g.listen) continue;
        for (const b of players) {
          if (a === b) continue;
          const gb = grant(b.view(), g.channel);
          const sb = sa && (await voiceSnapshot(b));
          if (gb?.speak && sb?.mic === 'granted' && !sb.muted && !stats.some((s) => s.channel === g.channel && s.identity === b.seat)) missing.push(`${a.name}<-${b.name}@${g.channel}`);
        }
      }
    }
    if (missing.length === 0 || Date.now() > deadline) {
      if (missing.length) console.log(`  (tracks still missing after 15 s: ${missing.join(', ')})`);
      break;
    }
    await sleep(500);
  }
  await sleep(1000); // first packets
}

// ---- hear-matrix ----

// energy[listener][channel][speaker] growth over the window.
export async function measure(players: Player[], ms = 2000) {
  const before = new Map(await Promise.all(players.map(async (p) => [p, await voiceStats(p)] as const)));
  await sleep(ms);
  const after = new Map(await Promise.all(players.map(async (p) => [p, await voiceStats(p)] as const)));
  const energy = new Map<Player, Map<string, Map<string, number>>>();
  for (const p of players) {
    const m = new Map<string, Map<string, number>>();
    for (const s of after.get(p)!) {
      const prev = before.get(p)!.find((x) => x.trackSid === s.trackSid);
      const e = s.totalAudioEnergy != null && prev?.totalAudioEnergy != null ? s.totalAudioEnergy - prev.totalAudioEnergy : 0;
      if (!m.has(s.channel)) m.set(s.channel, new Map());
      const ch = m.get(s.channel)!;
      ch.set(s.identity, (ch.get(s.identity) ?? 0) + e);
    }
    energy.set(p, m);
  }
  return energy;
}

export interface MatrixReport {
  step: string;
  checked: number;
  failures: string[];
  // Set when the window was not measurable: the step/grants per page before and after, as evidence.
  skipped?: { reason: string; before: Record<string, string>; after: Record<string, string> };
}

// Expected: A hears B on c  <=>  A.listen(c) && B.speak(c) && B's mic is granted.
// Also: A's rosters contain only seats holding a grant on c; A holds no channel without a grant.
export async function checkHearMatrix(players: Player[], stepName: string): Promise<MatrixReport> {
  const report: MatrixReport = { step: stepName, checked: 0, failures: [] };
  // Consistency guard: every player's latest frame must show the same step before and after the window,
  // and nobody's grants may change inside it. On a saturated shared machine frames lag by seconds per
  // page; a matrix mixing two steps is meaningless, so it is skipped rather than failed.
  const stepsBefore = players.map((p) => step(p));
  const grantsBefore = players.map((p) => JSON.stringify(p.view().voice));
  const skew = () => Object.fromEntries(players.map((p) => [p.name, `${step(p)} ${p.view().voice.map((g) => `${g.channel}:${g.speak ? 'S' : ''}${g.listen ? 'L' : ''}`).join(',')}`]));
  const before = skew();
  if (new Set(stepsBefore).size !== 1) {
    report.skipped = { reason: 'pages show different steps before the window', before, after: before };
    return report;
  }
  const snaps = new Map(await Promise.all(players.map(async (p) => [p, (await voiceSnapshot(p))!] as const)));
  const energy = await measure(players);
  if (players.some((p, i) => JSON.stringify(p.view().voice) !== grantsBefore[i] || step(p) !== stepsBefore[0])) {
    report.skipped = { reason: 'step or grants changed during the 2 s window', before, after: skew() };
    return report;
  }
  for (const a of players) {
    const va = a.view();
    const sa = snaps.get(a)!;
    for (const b of players) {
      if (a === b) continue;
      const vb = b.view();
      const sb = snaps.get(b)!;
      for (const ga of va.voice) {
        if (!(ga.listen || ga.speak)) continue;
        const gb = grant(vb, ga.channel);
        const expected = ga.listen && !!gb?.speak && sb.mic === 'granted' && !sb.muted;
        const got = (energy.get(a)!.get(ga.channel)?.get(b.seat) ?? 0) > ENERGY_MIN;
        report.checked++;
        if (expected !== got) report.failures.push(`${stepName}: ${a.name}(${a.seat}) ${expected ? 'should hear' : 'must not hear'} ${b.name}(${b.seat}) on ${ga.channel} (energy ${(energy.get(a)!.get(ga.channel)?.get(b.seat) ?? 0).toFixed(4)})`);
      }
      // roster: B appears in A's channel roster only if B holds a grant there
      for (const [ch, c] of Object.entries(sa.channels)) {
        const inRoster = c.participants.some((x) => x.identity === b.seat);
        const gb = grant(vb, ch);
        if (inRoster && !(gb && (gb.listen || gb.speak))) report.failures.push(`${stepName}: ${a.name} sees ${b.name} in ${ch} roster without a grant`);
        if (inRoster && gb && !gb.speak) report.failures.push(`${stepName}: ${a.name} sees listen-only ${b.name} in ${ch} roster (should be hidden)`);
      }
    }
    for (const ch of Object.keys(sa.channels)) {
      const g = grant(va, ch);
      if (!g || !(g.listen || g.speak)) report.failures.push(`${stepName}: ${a.name} holds channel ${ch} without a grant`);
    }
  }
  return report;
}

// ---- wire: `voice` frames carry only channels the seat is granted at that time ----

interface VoiceFrame {
  t: 'voice';
  gen: number;
  sessions: { channel: string; listen: boolean; speak: boolean; token: string }[];
}
export function voiceFrameLeaks(p: Player): string[] {
  const out: string[] = [];
  let current: VoiceGrant[] = [];
  for (const f of p.frames) {
    const m = f.msg as unknown as { t: string };
    if (m.t === 'state') current = (f.msg as { view: SeatView }).view.voice;
    if (m.t === 'voice') {
      const vf = f.msg as unknown as VoiceFrame;
      for (const s of vf.sessions) {
        const g = current.find((x) => x.channel === s.channel);
        if (!g || !(g.listen || g.speak)) out.push(`${p.name}: voice frame carries ${s.channel} without a current grant`);
        else if (s.speak && !g.speak) out.push(`${p.name}: voice frame grants speak on ${s.channel} beyond the state grant`);
      }
    }
  }
  return out;
}
export const voiceFrames = (p: Player) => p.frames.filter((f) => (f.msg as unknown as { t: string }).t === 'voice');

// ---- scripted play through the page's client (same route a browser uses) ----

const send = (p: Player, msg: unknown) => p.page.evaluate((m) => (globalThis as any).__moonveil.send(m), msg);

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

// One legal choice per available action, read from the seat's own snapshot. Mirrors apps/server/test/match-driver.ts.
export async function botAct(p: Player, r: () => number): Promise<number> {
  const g = game(p);
  const me = g?.me;
  if (!g || !me || p.view().status !== 'playing') return 0;
  let n = 0;
  for (const a of me.actions as { type: string; targets?: number[]; canUse?: boolean }[]) {
    let action: Record<string, unknown> | null = null;
    switch (a.type) {
      case 'wolf.pick':
      case 'guard.protect':
      case 'hunter.shoot':
        action = { type: a.type, target: a.targets?.length && r() < 0.85 ? pick(r, a.targets) : 'pass' };
        break;
      case 'seer.inspect':
        if (a.targets?.length) action = { type: a.type, target: pick(r, a.targets) };
        break;
      case 'witch.heal':
        if (a.canUse) action = { type: a.type, use: r() < 0.5 };
        break;
      case 'witch.poison':
        action = { type: a.type, target: a.targets?.length && r() < 0.3 ? pick(r, a.targets) : 'pass' };
        break;
      case 'vote.nominate':
        // Bias towards one target so trials (defense) actually happen.
        action = { type: a.type, target: a.targets?.length && r() < 0.9 ? a.targets[0] : 'skip' };
        break;
      case 'vote.confirm':
        action = { type: a.type, choice: r() < 0.7 ? 'yes' : 'no' };
        break;
    }
    if (action) {
      await send(p, { t: 'act', action });
      n++;
    }
  }
  return n;
}

export const moderatorClose = (mod: Player) => send(mod, { t: 'act', action: { type: 'step.close' } });

// Wait until every player's view shows a step other than `from` (or the match ended).
export async function waitStepChange(players: Player[], from: string, timeout = 90_000) {
  for (const p of players) await expect.poll(() => (p.view().status !== 'playing' ? 'ended' : step(p)), { timeout }).not.toBe(from);
}
