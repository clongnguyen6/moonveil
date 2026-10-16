// Opt-in scale run: E2E_SCALE=10,12,16 npm run e2e:scale (sampler: scripts/sample-resources.mjs). FIXTURE engine. Logs one `SCALE {json}` line per size.
// The last player uses Pixel 7 emulation to check the lobby list on a phone at that size.
import { devices } from '@playwright/test';
import { expect, type Player, test } from '../harness/index.ts';
import { assertNoLeaks, endedAt, fixtureGame as g } from './fixture-helpers.ts';

const sizes = (process.env.E2E_SCALE ?? '').split(',').filter(Boolean).map(Number);
const { defaultBrowserType: _, ...pixel } = devices['Pixel 7'];

const firstAt = (p: Player, pred: (v: ReturnType<Player['view']>) => boolean, from = 0) =>
  p.frames.slice(from).find((f) => f.msg.t === 'state' && pred(f.msg.view))?.at ?? NaN;

for (const n of sizes) {
  test(`scale ${n}: lobby + stub match isolation`, async ({ table }) => {
    test.setTimeout(240_000);
    const players: Player[] = [];
    for (let i = 0; i < n; i++) players.push(await table.player(`P${String(i).padStart(2, '0')}`, i === n - 1 ? pixel : {}));
    const [host, ...others] = players as [Player, ...Player[]];

    const t0 = Date.now();
    const code = await table.seat('automatic', host, others);
    const seatMs = Date.now() - t0;

    const phone = players[n - 1]!;
    await expect(phone.page.getByTestId('seat')).toHaveCount(n);
    const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    // Seat cap: one more than the engine max is rejected.
    let extraRejected: boolean | null = null;
    if (n >= host.view().limits.maxPlayers) {
      const extra = await table.player('Extra');
      await extra.page.goto(`/r/${code}`);
      await extra.fillProfile();
      await extra.page.getByTestId('join').click();
      await expect(extra.page.getByTestId('error')).toContainText('full');
      extraRejected = true;
    }

    const marks = players.map((p) => p.frames.length);
    const tStart = Date.now();
    await host.page.getByTestId('start').click();
    for (const p of players) await expect(p.page.getByTestId('phase')).toHaveText('hidden');
    const startFanout = Math.max(...players.map((p, i) => firstAt(p, (v) => v.status === 'playing', marks[i]))) - tStart;

    const members = players.filter((p) => g(p).me!.inGroup);
    const group = members.map((p) => p.seat);
    const key = g(members[0]!).group!.key;
    const outsiders = players.filter((p) => !group.includes(p.seat));
    const before = new Map(outsiders.map((o) => [o, o.dataFrames().length]));
    await members[0]!.page.getByTestId(`mark-${outsiders[0]!.seat}`).click();
    for (const m of members) await expect(m.page.getByTestId('group')).toContainText('→');
    await host.page.waitForTimeout(300);
    for (const o of outsiders) expect(o.dataFrames().length).toBe(before.get(o));

    // Timer-driven phase change: spread between first and last client receiving it.
    for (const p of players) await expect(p.page.getByTestId('phase')).toHaveText('open', { timeout: 20_000 });
    const openAt = players.map((p) => firstAt(p, (v) => (v.game as { phase?: string })?.phase === 'open'));
    const openSpread = Math.max(...openAt) - Math.min(...openAt);

    for (const p of players) await expect(p.page.getByTestId('reveal')).toBeVisible({ timeout: 60_000 });
    assertNoLeaks(players, key, group, new Map(players.map((p) => [p, endedAt(p)])));

    const states = players.flatMap((p) => p.frames.filter((f) => f.msg.t === 'state'));
    const bytes = players.map((p) => p.frames.reduce((a, f) => a + f.raw.length, 0));
    console.log(
      'SCALE ' +
        JSON.stringify({
          n,
          seatMs,
          startFanoutMs: startFanout,
          openSpreadMs: openSpread,
          groupSize: group.length,
          stateFramesPerPlayer: Math.round(states.length / n),
          maxStateBytes: Math.max(...states.map((f) => f.raw.length)),
          bytesPerPlayerMax: Math.max(...bytes),
          phoneOverflowPx: overflow,
          extraRejected,
        }),
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test.skip(sizes.length === 0, 'set E2E_SCALE to run');
