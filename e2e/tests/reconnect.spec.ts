// Reload and network drop keep identity/seat and grant no extra knowledge. Moderator mode = no timers.
import { expect, type Player, test } from '../harness/index.ts';

const gameOf = (p: Player) => JSON.stringify(p.view().game);

test('reload and network drop keep seat; presence hidden from players during secret phase', async ({ table }) => {
  test.setTimeout(90_000);
  const mod = await table.player('Mod');
  const ps: Player[] = [];
  for (const n of ['Ann', 'Bao', 'Chi', 'Dan']) ps.push(await table.player(n));
  const [ann, bao, chi] = ps as [Player, Player, Player];
  await table.seat('moderator', mod, ps);

  // Lobby reload keeps seat, name, readiness.
  const annSeat = ann.seat;
  await ann.page.reload();
  await ann.waitConnected();
  expect(ann.view().me.seat).toBe(annSeat);
  expect(ann.view().players.find((p) => p.seat === annSeat)).toMatchObject({ name: 'Ann', ready: true });

  await mod.page.getByTestId('start').click();
  for (const p of ps) await expect(p.page.getByTestId('phase')).toHaveText('hidden');
  const annGame = gameOf(ann);
  const baoMark = bao.dataFrames().length;
  const modMark = mod.dataFrames().length;

  // Reload mid secret phase: same seat, identical game view, no new knowledge.
  await ann.page.reload();
  await ann.waitConnected();
  expect(ann.view().me.seat).toBe(annSeat);
  expect(gameOf(ann)).toBe(annGame);
  await expect(ann.page.getByTestId('my-secret')).toHaveText((ann.view().game as { me: { secret: string } }).me.secret);

  // Network drop mid secret phase.
  const chiSeat = chi.seat;
  const chiGame = gameOf(chi);
  await chi.dropNetwork();
  await chi.waitConnected();
  expect(chi.view().me.seat).toBe(chiSeat);
  expect(gameOf(chi)).toBe(chiGame);

  // Players saw nothing of either disconnect; moderator did.
  await bao.page.waitForTimeout(300);
  expect(bao.dataFrames().length).toBe(baoMark);
  expect(mod.dataFrames().length).toBeGreaterThan(modMark);
});

test('second tab takes over the seat; first tab can reclaim', async ({ table }) => {
  const host = await table.player('Ann');
  const code = await host.createRoom('automatic');
  const seat = host.seat;
  const tab2 = await host.context.newPage();
  await tab2.goto(`/r/${code}`);
  await expect(tab2.getByTestId('you')).toContainText('Ann');
  await expect(host.page.getByTestId('conn')).toContainText('another tab');
  await host.page.getByRole('button', { name: 'Use here' }).click();
  await host.waitConnected();
  expect(host.view().me.seat).toBe(seat);
});
