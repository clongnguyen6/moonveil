// LiveKit Cloud runtime check through a deployed Moonveil (CLOUD.md §5, approved 2026-10-17: ≤ 100 participant-
// minutes in total for probes). Smallest real match: 7 players (rules Batch A minimum) + moderator = 8 pages.
// Path: lobby → night.main (wolves only) → night.witch → day.discussion → day.vote (everyone nominates one seat)
// → day.defense → day.confirm (yes) → death → next night (ghost + rotation + revocation) → leave.
// Scene loop stopped, join() per page, no traces. Prints the running participant-minute estimate and aborts
// (leaving voice first) before VOICE_CLOUD_CAP_MIN (default 60). Tokens stay in memory and are never printed.
import { expect, type Player, test } from '../../../e2e/harness/index.ts';
import { botAct, checkHearMatrix, game, grants, joinVoice, type MatrixReport, moderatorClose, step, voiceFrameLeaks, voiceFrames, voiceSettled, voiceSnapshot, waitStepChange } from './helpers.ts';

const CAP_MIN = Number(process.env.VOICE_CLOUD_CAP_MIN ?? 60);
const NAMES = ['Ann', 'Bao', 'Chi', 'Dan', 'Eve', 'Fay', 'Gia'];
const SCENE = (process.env.MOONVEIL_SCENE ?? 'off') as 'off' | 'low' | 'high';

// ---- participant-minute budget: sum over pages of connected channels × elapsed (sampled every 5 s) ----
class Budget {
  minutes = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = Date.now();
  private pages: Player[];
  private onAbort: () => Promise<void>;
  constructor(pages: Player[], onAbort: () => Promise<void>) {
    this.pages = pages;
    this.onAbort = onAbort;
  }
  start() {
    this.timer = setInterval(() => void this.sample(), 5000);
  }
  private async sample() {
    const now = Date.now();
    const dt = (now - this.last) / 60_000;
    this.last = now;
    let channels = 0;
    for (const p of this.pages) {
      const s = await voiceSnapshot(p).catch(() => null);
      if (s) channels += Object.values(s.channels).filter((c) => c.state === 'connected' || c.state === 'reconnecting').length;
    }
    this.minutes += channels * dt;
    if (this.minutes >= CAP_MIN) {
      console.log(`  BUDGET: ${this.minutes.toFixed(1)} participant-minutes reached the cap ${CAP_MIN}; leaving voice and aborting`);
      this.stop();
      await this.onAbort();
    }
  }
  log(label: string) {
    console.log(`  budget after ${label}: ~${this.minutes.toFixed(1)} participant-minutes (cap ${CAP_MIN})`);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

const leaveAll = async (pages: Player[]): Promise<void> => {
  await Promise.all(pages.map((p) => p.page.evaluate(() => (globalThis as any).__moonveil?.voice?.leave?.()).catch(() => undefined)));
};
const wssHost = (s: { url: string }) => new URL(s.url).host;
// LiveKit's token pre-check: 200 = the token would be accepted for a join; anything else = rejected.
async function validateToken(host: string, token: string): Promise<number> {
  const r = await fetch(`https://${host}/rtc/validate?access_token=${encodeURIComponent(token)}&protocol=16&sdk=js&version=2.22.4`).catch(() => null);
  return r ? r.status : 0;
}

test('LiveKit Cloud through the deployed app: connect, region, publish/subscribe, night, death → re-issue + revocation, hidden roles', async ({ table }) => {
  const players: Player[] = [];
  for (const n of NAMES) {
    const p = await table.player(n);
    await p.context.addInitScript((scene) => {
      (globalThis as any).__MOONVEIL_SCENE = scene;
      if (scene === 'off') {
        globalThis.requestAnimationFrame = () => 0;
        globalThis.cancelAnimationFrame = () => {};
      }
    }, SCENE);
    players.push(p);
  }
  const mod = await table.player('Mod');
  await mod.context.addInitScript(() => { globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {}; });
  const all = [...players, mod];
  const budget = new Budget(all, () => leaveAll(all));
  const reports: MatrixReport[] = [];
  const findings: string[] = [];
  const note = (s: string) => { findings.push(s); console.log(`  finding: ${s}`); };

  try {
    await table.seat('moderator', mod, players);
    await joinVoice(all);
    budget.start();
    await voiceSettled(all);
    const sess = await voiceSnapshot(players[0]!);
    const url = players[0]!.view() && (voiceFrames(players[0]!).at(-1)?.msg as unknown as { sessions: { url: string }[] })?.sessions?.[0]?.url;
    note(`signaling URL host: ${url ? wssHost({ url }) : 'n/a'}; channels in lobby: ${Object.keys(sess?.channels ?? {}).join(',')}`);
    // Region: LiveKit Cloud answers /settings/regions for a valid token (token stays in memory; only names are printed).
    const firstSession = (voiceFrames(players[0]!).at(-1)?.msg as unknown as { sessions: { url: string; token: string }[] })?.sessions?.[0];
    if (firstSession) {
      const r = await fetch(`https://${wssHost(firstSession)}/settings/regions`, { headers: { Authorization: `Bearer ${firstSession.token}` } }).catch(() => null);
      const body = r && r.ok ? ((await r.json().catch(() => null)) as { regions?: { region: string; url: string; distance?: number }[] } | null) : null;
      note(`regions endpoint: ${r ? r.status : 'unreachable'}; regions: ${body?.regions?.map((x) => `${x.region}${x.distance != null ? `@${Math.round(x.distance)}km` : ''}`).join(', ') ?? 'n/a'}`);
    }
    reports.push(await checkHearMatrix(all, 'lobby'));
    budget.log('lobby');

    await mod.page.getByTestId('start').click();
    for (const p of players) await expect.poll(() => p.view().status).toBe('playing');
    // night.main: wolves only
    await voiceSettled(all);
    reports.push(await checkHearMatrix(all, `night.main`));
    const wolves = players.filter((p) => grants(p).some((g) => g.channel === 'wolves'));
    note(`night: ${wolves.length} wolves hold the wolves channel; ${players.length - wolves.length} others hold none`);
    budget.log('night.main');
    for (const p of players) await botAct(p, () => 0.5);
    await moderatorClose(mod); await waitStepChange(players, 'night.main');
    if (step(players[0]!) === 'night.witch') { await moderatorClose(mod); await waitStepChange(players, 'night.witch'); }
    if (step(players[0]!) === 'hunter') { await moderatorClose(mod); await waitStepChange(players, 'hunter'); }
    // day.discussion: everyone alive speaks; a seat that died at night is a hidden ghost already
    await voiceSettled(all);
    reports.push(await checkHearMatrix(all, step(players[0]!)));
    budget.log('day.discussion');
    const livingBefore = players.filter((p) => game(p)?.me?.alive);
    const victim = livingBefore[livingBefore.length - 1]!; // nominate the last living seat
    const victimIdx = game(victim)!.me!.seat;
    const victimPublicToken = (voiceFrames(victim).at(-1)?.msg as unknown as { sessions: { channel: string; token: string; url: string }[] }).sessions.find((s) => s.channel === 'public');
    await moderatorClose(mod); await waitStepChange(players, 'day.discussion');
    // day.vote: all nominate the victim
    for (const p of players) if (game(p)?.me?.alive) await p.page.evaluate((t) => (globalThis as any).__moonveil.send({ t: 'act', action: { type: 'vote.nominate', target: t } }), victimIdx);
    await moderatorClose(mod); await waitStepChange(players, 'day.vote');
    if (step(players[0]!) === 'day.defense') {
      await voiceSettled(all);
      reports.push(await checkHearMatrix(all, 'day.defense'));
      budget.log('day.defense');
      await moderatorClose(mod); await waitStepChange(players, 'day.defense');
    }
    if (step(players[0]!) === 'day.confirm') {
      for (const p of players) if (game(p)?.me?.alive && game(p)!.me!.seat !== victimIdx) await p.page.evaluate(() => (globalThis as any).__moonveil.send({ t: 'act', action: { type: 'vote.confirm', choice: 'yes' } }));
      await moderatorClose(mod); await waitStepChange(players, 'day.confirm');
    }
    if (step(players[0]!) === 'hunter') { await moderatorClose(mod); await waitStepChange(players, 'hunter'); }
    // next night: the executed seat is a ghost (hidden public, ghosts room); its old public token must be revoked
    await voiceSettled(all);
    const vs = await voiceSnapshot(victim);
    note(`victim after execution: alive=${game(victim)?.me?.alive}; channels=${Object.keys(vs?.channels ?? {}).join(',')}`);
    reports.push(await checkHearMatrix(all, step(players[0]!)));
    budget.log('night 2');
    if (victimPublicToken) {
      const host = wssHost(victimPublicToken);
      const oldStatus = await validateToken(host, victimPublicToken.token);
      const fresh = (voiceFrames(players.find((p) => game(p)?.me?.alive && grants(p).some((g) => g.channel === 'wolves')) ?? players[0]!).at(-1)?.msg as unknown as { sessions: { token: string }[] }).sessions[0];
      const freshStatus = fresh ? await validateToken(host, fresh.token) : -1;
      note(`revocation: old public token validate=${oldStatus} (expect non-200 on Cloud), fresh token validate=${freshStatus} (expect 200)`);
    }
    const lk = await voiceSnapshot(mod);
    note(`moderator holds ${Object.keys(lk?.channels ?? {}).join(',')} (hidden: covered by the roster checks in every window)`);
  } finally {
    budget.stop();
    await leaveAll(all);
    budget.log('end (after leave)');
  }

  const done = reports.filter((r) => !r.skipped);
  const failures = done.flatMap((r) => r.failures);
  console.log(`hear-matrix via Cloud: ${done.reduce((n, r) => n + r.checked, 0)} pair-channel checks over ${done.length} steps [${done.map((r) => r.step).join(' → ')}], ${failures.length} failures; skipped ${reports.length - done.length}`);
  console.log(`findings:\n  - ${findings.join('\n  - ')}`);
  expect(failures, failures.join('\n')).toEqual([]);
  const leaks = all.flatMap(voiceFrameLeaks);
  expect(leaks, leaks.join('\n')).toEqual([]);
});
