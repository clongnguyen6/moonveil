// Silent network: link dies without a close. Client must notice via its watchdog (HEARTBEAT_MS * 2.5 = 25 s)
// or the `online` event, then resume the same seat with the latest state. Chromium offline emulation stops
// WS frames without closing the socket, which reproduces a dead link.
import { expect, type Player, test } from '../harness/index.ts';

const log = (o: object) => console.log('NETWORK ' + JSON.stringify(o));

async function moderated(table: import('../harness/index.ts').Table) {
  const mod = await table.player('Mod');
  const ps: Player[] = [];
  for (const n of ['Ann', 'Bao', 'Chi']) ps.push(await table.player(n));
  await table.seat('moderator', mod, ps);
  await mod.page.getByTestId('start').click();
  for (const p of ps) await expect(p.page.getByTestId('phase')).toHaveText('hidden');
  return { mod, ps };
}

test('long silent outage: watchdog notices, seat resumes with latest state', async ({ table }) => {
  test.setTimeout(90_000);
  const { mod, ps } = await moderated(table);
  const [ann, bao] = ps as [Player, Player];
  const seat = ann.seat;
  const baoFrames = bao.dataFrames().length;
  await ann.context.setOffline(true);
  const t0 = Date.now();
  await expect(ann.page.getByTestId('conn')).toContainText('Reconnecting', { timeout: 30_000 });
  const clientNoticedMs = Date.now() - t0;
  await expect.poll(() => mod.view().players.find((p) => p.seat === seat)?.connected, { timeout: 30_000 }).toBe(false);
  const serverNoticedMs = Date.now() - t0;
  expect(bao.dataFrames().length, 'secret phase: players learn nothing of the drop').toBe(baoFrames);

  await mod.page.getByTestId('advance').click();
  const t1 = Date.now();
  await ann.context.setOffline(false);
  await expect(ann.page.getByTestId('phase')).toHaveText('open', { timeout: 15_000 });
  await ann.waitConnected();
  expect(ann.view().me.seat).toBe(seat);
  log({ case: 'long', clientNoticedMs, serverNoticedMs, recoverMs: Date.now() - t1 });
  expect(clientNoticedMs).toBeLessThan(28_000);
});

test('short blip: online event forces a fresh connection; state catches up', async ({ table }) => {
  test.setTimeout(60_000);
  const { mod, ps } = await moderated(table);
  const ann = ps[0]!;
  const seat = ann.seat;
  const welcomes = () => ann.frames.filter((f) => f.msg.t === 'welcome').length;
  const w0 = welcomes();
  await ann.context.setOffline(true);
  await mod.page.getByTestId('advance').click();
  await ann.page.waitForTimeout(2000);
  const t1 = Date.now();
  await ann.context.setOffline(false);
  await expect(ann.page.getByTestId('phase')).toHaveText('open', { timeout: 10_000 });
  await ann.waitConnected();
  expect(welcomes()).toBeGreaterThan(w0);
  expect(ann.view().me.seat).toBe(seat);
  log({ case: 'blip', recoverMs: Date.now() - t1 });
});
