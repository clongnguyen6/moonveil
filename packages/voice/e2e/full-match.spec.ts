// Browser full matches with voice: 7 and 10 seats, both modes. After every step the measured hear-matrix
// (who actually receives audio from whom, per channel) must equal the one derived from each seat's grants
// in its own `state` view, rosters must contain only granted seats, and `voice` frames must never carry a
// channel the seat is not granted. Runs once foundation's wiring exposes `globalThis.__moonveil.voice`.
//
//   node scripts/env.mjs npm run e2e -w @moonveil/voice            # default: 7 seats moderator, 10 seats automatic
//   VOICE_E2E_SEATS=10 VOICE_E2E_AUTO_BUDGET_MS=300000 ... -g automatic
import { RoomServiceClient } from 'livekit-server-sdk';
import { expect, type Player, test } from '../../../e2e/harness/index.ts';
import { botAct, checkHearMatrix, game, type MatrixReport, moderatorClose, requireVoiceWiring, rng, sleep, step, voiceFrameLeaks, voiceFrames, voiceSettled, voiceSnapshot, waitStepChange } from './helpers.ts';

const SEATS = Number(process.env.VOICE_E2E_SEATS ?? 0);
const AUTO_BUDGET_MS = Number(process.env.VOICE_E2E_AUTO_BUDGET_MS ?? 5 * 60_000);
const NAMES = ['Ann', 'Bao', 'Chi', 'Dan', 'Eve', 'Fay', 'Gia', 'Hai', 'Ivy', 'Jun', 'Kim', 'Lan'];
const livekit = () => new RoomServiceClient(`http://127.0.0.1:${process.env.LIVEKIT_PORT ?? 4360}`, 'moonveil-e2e', 'moonveil-e2e-secret-not-for-production-000000000');

function summarize(reports: MatrixReport[]) {
  const done = reports.filter((r) => !r.skipped);
  const failures = done.flatMap((r) => r.failures);
  const checked = done.reduce((n, r) => n + r.checked, 0);
  const steps = done.map((r) => r.step);
  const skipped = reports.filter((r) => r.skipped);
  console.log(`hear-matrix: ${checked} pair-channel checks over ${done.length} steps [${steps.join(' → ')}], ${failures.length} failures; skipped windows: ${skipped.length}`);
  for (const r of skipped) {
    const changed = Object.keys(r.skipped!.after).filter((k) => r.skipped!.after[k] !== r.skipped!.before[k]);
    console.log(`  skipped ${r.step}: ${r.skipped!.reason}; pages that differ/changed: ${changed.map((k) => `${k} ${r.skipped!.before[k]} -> ${r.skipped!.after[k]}`).join(' | ') || JSON.stringify(r.skipped!.before)}`);
  }
  return { failures, checked, steps, skipped: skipped.length };
}

async function seatTable(table: { player(name: string): Promise<Player>; seat(mode: 'automatic' | 'moderator', host: Player, others: Player[]): Promise<string> }, mode: 'automatic' | 'moderator', seats: number) {
  const players: Player[] = [];
  for (const n of NAMES.slice(0, seats)) players.push(await table.player(n));
  let mod: Player | null = null;
  let code: string;
  if (mode === 'moderator') {
    mod = await table.player('Mod');
    code = await table.seat('moderator', mod, players);
  } else {
    const [host, ...others] = players as [Player, ...Player[]];
    code = await table.seat('automatic', host, others);
  }
  return { players, mod, code };
}

test('moderator mode, full match with voice: hear-matrix equals grants on every step', async ({ table }) => {
  const seats = SEATS || 7;
  const { players, mod, code } = await seatTable(table, 'moderator', seats);
  const all = [...players, mod!];
  await requireVoiceWiring(players[0]!);

  // lobby: everyone speaks and hears; the moderator listens hidden
  await voiceSettled(all);
  const reports: MatrixReport[] = [await checkHearMatrix(all, 'lobby')];

  await mod!.page.getByTestId('start').click();
  for (const p of players) await expect.poll(() => p.view().status).toBe('playing');
  const r = rng(`voice-mod-${seats}`);
  for (let i = 0; i < 80 && players[0]!.view().status === 'playing'; i++) {
    const kind = step(players[0]!);
    await voiceSettled(all);
    reports.push(await checkHearMatrix(all, `${kind}#${i}`));
    for (const p of players) await botAct(p, r);
    // Some steps may close on their own (fixed-length steps, Hunter early close): close only the step we measured.
    if (players[0]!.view().status === 'playing' && step(players[0]!) === kind) await moderatorClose(mod!);
    await waitStepChange(players, kind);
  }
  expect(players[0]!.view().status, 'match ended').toBe('ended');
  await voiceSettled(all);
  reports.push(await checkHearMatrix(all, 'ended'));

  const { failures, steps } = summarize(reports);
  expect(failures, failures.join('\n')).toEqual([]);
  expect(steps.some((s) => s.startsWith('night.')), 'saw a night').toBe(true);
  expect(steps.some((s) => s.startsWith('day.')), 'saw a day').toBe(true);
  const leaks = all.flatMap(voiceFrameLeaks);
  expect(leaks, leaks.join('\n')).toEqual([]);
  expect(voiceFrames(players[0]!).length, 'player received voice frames').toBeGreaterThan(0);
  // LiveKit side: in every room of this match the moderator's hidden flag equals !speak of its current grant
  // (listen-only while playing => hidden; at `ended` the engine grants everyone public speak => visible).
  const rooms = await livekit().listRooms();
  for (const room of rooms.filter((x) => x.name.startsWith(code))) {
    const channel = room.name.slice(code.length + 1).replace(/-g\d+$/, '');
    const g = mod!.view().voice.find((x) => x.channel === channel);
    const ps = await livekit().listParticipants(room.name);
    const modP = ps.find((x) => x.identity === mod!.seat);
    if (modP && g) expect(modP.permission?.hidden, `moderator hidden=${!g.speak} in ${room.name}`).toBe(!g.speak);
  }
});

test('automatic mode, 10 seats with voice: hear-matrix on every step within the time budget (real timers)', async ({ table }) => {
  const seats = SEATS || 10;
  const { players } = await seatTable(table, 'automatic', seats);
  await requireVoiceWiring(players[0]!);
  await voiceSettled(players);
  const reports: MatrixReport[] = [await checkHearMatrix(players, 'lobby')];

  await players[0]!.page.getByTestId('start').click();
  for (const p of players) await expect.poll(() => p.view().status).toBe('playing');
  const r = rng(`voice-auto-${seats}`);
  const start = Date.now();
  let last = '';
  while (players[0]!.view().status === 'playing' && Date.now() - start < AUTO_BUDGET_MS) {
    const kind = step(players[0]!);
    if (kind !== last) {
      await voiceSettled(players);
      reports.push(await checkHearMatrix(players, kind));
      for (const p of players) await botAct(p, r);
      last = kind;
    }
    await sleep(1000);
  }
  const { failures, steps } = summarize(reports);
  expect(failures, failures.join('\n')).toEqual([]);
  expect(steps.some((s) => s.startsWith('night.')), 'saw a night within the budget').toBe(true);
  expect(steps.some((s) => s.startsWith('day.')), 'saw a day within the budget').toBe(true);
  const leaks = players.flatMap(voiceFrameLeaks);
  expect(leaks, leaks.join('\n')).toEqual([]);
});

test('in-person room: no voice sessions anywhere, no LiveKit rooms', async ({ table }) => {
  const host = await table.player('Host');
  await host.page.goto('/');
  // Create through the client with voiceMode 'inPerson' (the UI control is game-ui scope; same wire message).
  await host.page.evaluate(() => (globalThis as any).__moonveil.create('automatic', { name: 'Host', appearance: { color: 'moss', hat: 'none' } }, 'inPerson'));
  await expect(host.page.getByTestId('room')).toBeVisible();
  const code = (await host.page.getByTestId('room-code').textContent())!.trim();
  const others: Player[] = [];
  for (const n of NAMES.slice(1, 7)) {
    const p = await table.player(n);
    await p.joinByCode(code);
    others.push(p);
  }
  const players = [host, ...others];
  for (const p of players) await p.ready();
  await expect.poll(() => host.view().voiceMode).toBe('inPerson');
  // text works without voice (lobby: everyone may speak on public; at night the policy would deny it)
  await host.page.evaluate(() => (globalThis as any).__moonveil.send({ t: 'say', channel: 'public', text: 'voice off, text on' }));
  for (const p of players) await expect.poll(() => p.frames.some((f) => (f.msg as unknown as { t: string }).t === 'chat' && (f.msg as unknown as { msg: { text: string } }).msg.text === 'voice off, text on'), { message: `${p.name} receives public text` }).toBe(true);
  await host.page.getByTestId('start').click();
  for (const p of players) await expect.poll(() => p.view().status).toBe('playing');
  await sleep(3000);
  // In-person: `state.voice` still carries the text grants (same policy; empty for a villager at night), but
  // the voice gateway gets none: no sessions are issued, no LiveKit room exists, the page holds no voice channel.
  for (const p of players) {
    const snap = await voiceSnapshot(p);
    if (snap) expect(Object.keys(snap.channels), `${p.name}: voice channels`).toEqual([]);
    expect(voiceFrames(p).flatMap((f) => (f.msg as unknown as { sessions: unknown[] }).sessions ?? []), `${p.name}: sessions in voice frames`).toEqual([]);
  }
  const rooms = await livekit().listRooms();
  expect(rooms.filter((x) => x.name.startsWith(code)).map((x) => x.name)).toEqual([]);
  void game;
});
