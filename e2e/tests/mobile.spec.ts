// Runs under mobile-chromium (Pixel 7) and mobile-webkit (iPhone 15) emulation. Not real devices.
import { expect, test } from '../harness/index.ts';

test('phone: join, ready, reload resume, no horizontal overflow', async ({ table }) => {
  const ann = await table.player('Ann');
  const bao = await table.player('Bao');
  const chi = await table.player('Chi');
  const code = await ann.createRoom('automatic');
  await bao.joinByLink(code);
  await chi.joinByCode(code);
  for (const p of [ann, bao, chi]) await p.ready();
  await expect(ann.page.getByTestId('start')).toBeEnabled();

  const seat = bao.seat;
  await bao.page.reload();
  await bao.waitConnected();
  expect(bao.view().me.seat).toBe(seat);

  for (const p of [ann, bao]) {
    const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await p.page.getByTestId('ready').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
