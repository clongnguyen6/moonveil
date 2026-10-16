// Wire-level knowledge isolation with real browsers. Uses the FIXTURE engine (no real rules).
import { expect, type Player, test } from '../harness/index.ts';

type G = { phase: string; me?: { secret: string; inGroup: boolean }; group?: { key: string; members: string[] }; reveal?: { seat: string; secret: string }[] };
const g = (p: Player) => p.view().game as G;

function assertNoLeaks(players: Player[], groupKey: string, group: string[], uptoFrames?: Map<Player, number>) {
  const secrets = new Map(players.map((p) => [p.seat, g(p).me!.secret]));
  for (const p of players) {
    const wire = p.frames.slice(0, uptoFrames?.get(p)).map((f) => f.raw).join('\n');
    for (const [seat, s] of secrets) if (seat !== p.seat) expect(wire.includes(s), `${p.name} saw ${seat}'s secret`).toBe(false);
    if (!group.includes(p.seat)) {
      expect(wire.includes(groupKey), `${p.name} saw group key`).toBe(false);
      expect(wire.includes('"group"'), `${p.name} got a group object`).toBe(false);
      expect(wire.includes('"inGroup":true'), `${p.name} saw membership`).toBe(false);
    }
  }
}

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
  const beforeReveal = new Map(
    players.map((p) => [p, p.frames.findIndex((f) => f.msg.t === 'state' && f.msg.view.status === 'ended')]),
  );
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
  const mv = mod.view().game as Required<G>;
  for (const p of players) expect(mv.reveal.find((r) => r.seat === p.seat)!.secret).toBe(g(p).me!.secret);
  assertNoLeaks(players, mv.group!.key, mv.group!.members);

  await mod.page.getByTestId('advance').click();
  for (const p of players) await expect(p.page.getByTestId('phase')).toHaveText('open');
});
