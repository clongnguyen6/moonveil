// Wire-level knowledge isolation with real browsers. Uses the FIXTURE engine (no real rules).
import { expect, type Player, test } from '../harness/index.ts';
import { assertNoLeaks, endedAt, type FixtureGame, fixtureGame as g } from './fixture-helpers.ts';

test('automatic mode, 8 browsers: each client receives only what its seat may know', async ({ table }) => {
  test.setTimeout(120_000);
  const names = ['Ann', 'Bao', 'Chi', 'Dan', 'Eve', 'Fay', 'Gia', 'Hai'];
  const players: Player[] = [];
  for (const n of names) players.push(await table.player(n));
  const [host, ...others] = players as [Player, ...Player[]];
  await table.seat('automatic', host, others);

  await host.page.getByTestId('start').click();
  for (const p of players) await expect(p.page.getByTestId('phase')).toHaveText('hidden');

  const members = players.filter((p) => g(p).me!.inGroup);
  expect(members).toHaveLength(2);
  const key = g(members[0]!).group!.key;
  const group = members.map((p) => p.seat);
  const outsiders = players.filter((p) => !group.includes(p.seat));
  expect(host.view().moderator).toBeNull();

  // Hidden action through the UI: outsiders must receive no frame at all (timing channel).
  const marks = new Map(players.map((p) => [p, p.dataFrames().length]));
  await members[0]!.page.getByTestId(`mark-${outsiders[0]!.seat}`).click();
  for (const m of members) await expect(m.page.getByTestId('group')).toContainText('→');
  await host.page.waitForTimeout(300);
  for (const o of outsiders) expect(o.dataFrames().length, `${o.name} got frames from a hidden action`).toBe(marks.get(o));

  // Through the whole game until the reveal, nothing leaks; then everyone sees the reveal.
  for (const p of players) await expect(p.page.getByTestId('reveal')).toBeVisible({ timeout: 45_000 });
  const beforeReveal = new Map(players.map((p) => [p, endedAt(p)]));
  assertNoLeaks(players, key, group, beforeReveal);
  for (const p of players) await expect(p.page.locator('[data-testid=reveal] li')).toHaveCount(8);
});

test('moderator mode, 7 players + moderator: moderator sees secrets, players do not', async ({ table }) => {
  test.setTimeout(120_000);
  const mod = await table.player('Mod');
  const players: Player[] = [];
  for (const n of ['Ann', 'Bao', 'Chi', 'Dan', 'Eve', 'Fay', 'Gia']) players.push(await table.player(n));
  await table.seat('moderator', mod, players);
  await expect(mod.page.getByTestId('ready')).toHaveCount(0);

  await mod.page.getByTestId('start').click();
  await expect(mod.page.locator('[data-testid=reveal] li')).toHaveCount(7);
  for (const p of players) {
    await expect(p.page.getByTestId('my-secret')).toBeVisible();
    await expect(p.page.getByTestId('reveal')).toHaveCount(0);
    await expect(p.page.getByTestId('advance')).toHaveCount(0);
  }
  const mv = mod.view().game as Required<FixtureGame>;
  for (const p of players) expect(mv.reveal.find((r) => r.seat === p.seat)!.secret).toBe(g(p).me!.secret);
  assertNoLeaks(players, mv.group!.key, mv.group!.members);

  await mod.page.getByTestId('advance').click();
  for (const p of players) await expect(p.page.getByTestId('phase')).toHaveText('open');
});
