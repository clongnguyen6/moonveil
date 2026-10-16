import { expect, test } from '../harness/index.ts';

test('create, join by code and link, appearance, ready, start gating, leave', async ({ table }) => {
  const ann = await table.player('Ann');
  const bao = await table.player('Bao');
  const chi = await table.player('Chi');
  const code = await ann.createRoom('automatic', { color: 'dusk', hat: 'beanie' });
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  expect(ann.view().players[0]).toMatchObject({ name: 'Ann', appearance: { color: 'dusk', hat: 'beanie' } });

  // Duplicate name rejected, then fixed.
  await bao.page.goto(`/r/${code}`);
  await bao.fillProfile('ann');
  await bao.page.getByTestId('join').click();
  await expect(bao.page.getByTestId('error')).toContainText('name');
  await bao.joinByLink(code, { color: 'river' });
  await chi.joinByCode(code.toLowerCase());

  await expect(ann.page.getByTestId('seat')).toHaveCount(3);
  await expect(ann.page.getByTestId('start')).toBeDisabled();
  await expect(bao.page.getByTestId('start')).toHaveCount(0);

  // Edit look in lobby propagates.
  await chi.page.getByTestId('edit-profile').click();
  await chi.page.getByTestId('color-berry').click();
  await chi.page.getByTestId('save-profile').click();
  await expect.poll(() => ann.view().players.find((p) => p.name === 'Chi')?.appearance.color).toBe('berry');

  for (const p of [ann, bao, chi]) await p.ready();
  await expect(ann.page.getByTestId('start')).toBeEnabled();

  await chi.page.getByTestId('leave').click();
  await expect(ann.page.getByTestId('seat')).toHaveCount(2);
  await expect(ann.page.getByTestId('start')).toBeDisabled();
});

test('unknown room code shows an error', async ({ table }) => {
  const p = await table.player('Zed');
  await p.page.goto('/');
  await p.fillProfile();
  await p.page.getByTestId('code').fill('ZZZZZZ');
  await p.page.getByTestId('join').click();
  await expect(p.page.getByTestId('error')).toContainText('no such room');
});
