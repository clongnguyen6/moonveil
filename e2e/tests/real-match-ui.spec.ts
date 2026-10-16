// ACCEPTANCE through the game UI (docs/ui/SELECTORS.md): full real-engine matches where every action goes through
// the DOM; assertions stay on each browser's wire. Projects (all browser EMULATION, not real devices):
//   ui-laptop (Desktop Chrome): 7-10 seats, both modes; ui-phone-chromium (Pixel 7) / ui-phone-webkit (iPhone 15): 7 seats.
// Paths covered inside each match: page reload during a vote, network drop at night, ghost UI for dead seats.
// Skips itself until the UI's entry screen exists in the served build (a skip is never a pass).
import type { GameView, SeatView } from '@moonveil/protocol';
import { assertOpenBallotsViews, assertOutcome, assertSeatIsolationViews } from '../../apps/server/test/assertions.ts';
import { expect, type Player, test } from '../harness/index.ts';
import { type BrowserMatch, game, runRealMatch } from '../harness/match.ts';
import { seatRealMatchUi, uiBotAct, uiCloseStep, uiPresent } from '../harness/ui.ts';

const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 4152);
const states = (p: Player): SeatView[] => p.frames.flatMap((f) => (f.msg.t === 'state' ? [f.msg.view] : []));
const isPhone = (name: string) => name.startsWith('ui-phone');

async function resumed(p: Player, seat: string) {
  await expect(p.page.locator('[data-testid=conn][data-status=open]')).toHaveCount(1, { timeout: 20_000 });
  await expect(p.page.getByTestId('room')).toHaveAttribute('data-status', 'playing');
  expect(p.view().me.seat).toBe(seat);
}

for (const mode of ['automatic', 'moderator'] as const) {
  for (const seats of [7, 8, 9, 10]) {
    test(`UI match, ${mode}, ${seats} browsers: reload + network drop, ghosts, open ballots, isolation, outcome`, async ({ table }, info) => {
      test.skip(isPhone(info.project.name) && seats !== 7, 'phone projects run 7 seats');
      test.setTimeout(isPhone(info.project.name) ? 420_000 : 300_000);
      const probe = await table.player('probe', { baseURL: `http://127.0.0.1:${REAL_PORT}` });
      test.skip(!(await uiPresent(probe)), 'game UI not wired in this build (no [data-testid=entry])');
      await probe.context.close();

      const m = await seatRealMatchUi(table, { mode, seats, baseURL: `http://127.0.0.1:${REAL_PORT}` });
      const stats = { ballotSteps: 0, reloads: 0, drops: 0, ghostChecks: 0, overflowChecks: 0 };
      await runRealMatch(
        m,
        `ui-${info.project.name}-${mode}-${seats}`,
        async (mm: BrowserMatch) => {
          const k = game(mm.driver)!.step.kind;
          const living = mm.players.filter((p) => game(p)!.me!.alive);
          // Reconnect path 1: a living seat reloads its page during the first vote.
          if ((k === 'day.vote' || k === 'day.confirm') && stats.reloads === 0 && living.length > 1) {
            const p = living[living.length - 1]!;
            const seat = p.seat;
            await p.page.reload();
            await resumed(p, seat);
            stats.reloads++;
          }
          // Reconnect path 2: a living seat loses its network for 3 s at the first night.
          if (k === 'night.main' && stats.drops === 0 && living.length > 2) {
            const p = living[1]!;
            const seat = p.seat;
            await p.dropNetwork(3_000);
            await resumed(p, seat);
            stats.drops++;
          }
          if (k === 'day.vote' || k === 'day.confirm') {
            await expect(async () => expect(assertOpenBallotsViews(mm.players.map((p) => p.view()))).toBe(true)).toPass({ timeout: 5_000 });
            stats.ballotSteps++;
          }
          // Ghost path: dead seats show the ghost bar and no action controls.
          for (const p of mm.players.filter((x) => !game(x)!.me!.alive)) {
            await expect(p.page.getByTestId('ghost-bar')).toBeVisible();
            await expect(p.page.getByTestId('confirm')).toHaveCount(0);
            stats.ghostChecks++;
          }
          if (isPhone(info.project.name) && stats.overflowChecks < 3) {
            for (const p of mm.players.slice(0, 2)) {
              const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
              expect(overflow, `${p.name}: horizontal overflow on ${k}`).toBeLessThanOrEqual(0);
            }
            stats.overflowChecks++;
          }
        },
        200,
        { act: uiBotAct, close: uiCloseStep },
      );
      expect(m.driver.view().status).toBe('ended');
      assertOutcome(game(m.players[0]!) as GameView);
      for (const p of m.players) assertSeatIsolationViews(states(p));
      console.log(`UIMATCH ${JSON.stringify({ project: info.project.name, mode, seats, steps: m.steps, ...stats, outcome: (game(m.players[0]!) as GameView).outcome })}`);
      expect(stats.ballotSteps).toBeGreaterThan(0);
      expect(stats.reloads + stats.drops).toBeGreaterThan(0);
    });
  }
}
