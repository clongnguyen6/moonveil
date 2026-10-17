// Rotation gap: time from a room rotation until audio from each expected speaker reappears at each listener.
// Same spec for local LiveKit (playwright.config.ts) and the deployed app on LiveKit Cloud (cloud.config.ts), so
// the two can be compared. Moderator mode (steps advance on command), 7 players + moderator, scene off, join()
// per page, no traces. Rotations covered: start (public closes, wolves open), night→day (public reopens),
// day execution (public rotates, ghost joins ghosts), defense (rotates only under the old accused-only rule).
// Cloud budget: VOICE_CLOUD_CAP_MIN (default 15 here). Tokens never printed.
import { expect, type Player, test } from '../../../e2e/harness/index.ts';
import { applySceneSwitch, audioArrivalGaps, botAct, game, gapStats, grants, joinVoice, leaveAllVoice, MinuteBudget, moderatorClose, step, voiceFrames, voiceSettled, voiceSnapshot, waitStepChange } from './helpers.ts';

const NAMES = ['Ann', 'Bao', 'Chi', 'Dan', 'Eve', 'Fay', 'Gia'];
const SCENE = (process.env.MOONVEIL_SCENE ?? 'off') as 'off' | 'low' | 'high';
const CAP = Number(process.env.VOICE_CLOUD_CAP_MIN ?? 15);
const TARGET = process.env.VOICE_CLOUD_URL ? 'cloud' : 'local';

// A rotation is visible on the wire as a `voice` frame whose public session names a new room generation.
const publicRoom = (p: Player) => ((voiceFrames(p).at(-1)?.msg as unknown as { sessions?: { channel: string; room?: string; token: string }[] })?.sessions ?? []).find((s) => s.channel === 'public');
const lastVoiceAt = (p: Player) => voiceFrames(p).at(-1)?.at ?? Date.now();

test(`rotation gaps (${TARGET}): audio reappearance after each rotation`, async ({ table }) => {
  test.setTimeout(12 * 60_000);
  const players: Player[] = [];
  for (const n of NAMES) { const p = await table.player(n); await applySceneSwitch(p, SCENE); players.push(p); }
  const mod = await table.player('Mod'); await applySceneSwitch(mod, SCENE);
  const all = [...players, mod];
  const budget = new MinuteBudget(all, CAP, () => leaveAllVoice(all));
  const results: Record<string, ReturnType<typeof gapStats>> = {};
  const record = (label: string, gaps: Record<string, number>) => {
    results[label] = gapStats(gaps);
    console.log(`  gap ${label}: n=${results[label]!.n} never=${results[label]!.never} min=${results[label]!.min}ms median=${results[label]!.median}ms p95=${results[label]!.p95}ms max=${results[label]!.max}ms`);
  };
  // Measure from the first new `voice` frame of this transition, polling immediately (no settle first): the gap
  // is the time until each listener's received energy from each expected speaker starts to grow.
  const measure = async (label: string) => {
    // wait only until every page has received its sessions for the new step (grants = channels), not for audio
    for (const p of all) await expect.poll(async () => { const s = await voiceSnapshot(p); return s ? Object.keys(s.channels).sort().join() === grants(p).filter((g) => g.listen || g.speak).map((g) => g.channel).sort().join() : false; }, { timeout: 60_000 }).toBe(true);
    const since = Math.min(...all.map(lastVoiceAt));
    record(label, await audioArrivalGaps(all, since, 25_000));
    await voiceSettled(all, 60_000);
    budget.log(label);
  };
  try {
    await table.seat('moderator', mod, players);
    await joinVoice(all);
    budget.start();
    await measure('lobby join');

    await mod.page.getByTestId('start').click();
    for (const p of players) await expect.poll(() => p.view().status).toBe('playing');
    await measure('start → night.main (wolves room opens)');
    for (const p of players) await botAct(p, () => 0.5);
    await moderatorClose(mod); await waitStepChange(players, 'night.main');
    if (step(players[0]!) === 'night.witch') { await moderatorClose(mod); await waitStepChange(players, 'night.witch'); }
    if (step(players[0]!) === 'hunter') { await moderatorClose(mod); await waitStepChange(players, 'hunter'); }
    await measure('night → day.discussion (public reopens)');
    // execution path: everyone nominates the last living seat
    const living = players.filter((p) => game(p)?.me?.alive);
    const victimIdx = game(living[living.length - 1]!)!.me!.seat;
    const publicBefore = publicRoom(players[0]!)?.room;
    await moderatorClose(mod); await waitStepChange(players, 'day.discussion');
    for (const p of players) if (game(p)?.me?.alive) await p.page.evaluate((t) => (globalThis as any).__moonveil.send({ t: 'act', action: { type: 'vote.nominate', target: t } }), victimIdx);
    await moderatorClose(mod); await waitStepChange(players, 'day.vote');
    if (step(players[0]!) === 'day.defense') {
      if (publicRoom(players[0]!)?.room !== publicBefore) await measure('day.vote → day.defense (old rule: rotation)');
      else console.log('  defense: no rotation (new rule, every living player speaks)');
      await moderatorClose(mod); await waitStepChange(players, 'day.defense');
    }
    if (step(players[0]!) === 'day.confirm') {
      for (const p of players) if (game(p)?.me?.alive && game(p)!.me!.seat !== victimIdx) await p.page.evaluate(() => (globalThis as any).__moonveil.send({ t: 'act', action: { type: 'vote.confirm', choice: 'yes' } }));
      await moderatorClose(mod); await waitStepChange(players, 'day.confirm');
    }
    if (step(players[0]!) === 'hunter') { await moderatorClose(mod); await waitStepChange(players, 'hunter'); }
    await measure('execution → next step (public rotates, ghost joins ghosts)');
    if (step(players[0]!).startsWith('night')) {
      for (const p of players) await botAct(p, () => 0.5);
      await moderatorClose(mod); await waitStepChange(players, step(players[0]!));
      if (step(players[0]!) === 'night.witch') { await moderatorClose(mod); await waitStepChange(players, 'night.witch'); }
      if (step(players[0]!) === 'hunter') { await moderatorClose(mod); await waitStepChange(players, 'hunter'); }
      await measure('night 2 → day 2 (public reopens again)');
    }
  } finally {
    budget.stop();
    await leaveAllVoice(all);
    budget.log('end (after leave)');
  }
  console.log(`rotation gaps (${TARGET}): ${JSON.stringify(results)}`);
  const never = Object.values(results).reduce((n, r) => n + r.never, 0);
  expect(never, 'every expected speaker was eventually heard within 20 s of each rotation').toBe(0);
});
