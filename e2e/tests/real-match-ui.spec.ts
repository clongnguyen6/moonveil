// ACCEPTANCE through the game UI (docs/ui/SELECTORS.md): same matches and wire assertions as real-match.spec.ts,
// but every action is performed through the DOM. Skips itself until the UI's entry screen exists in this build.
import type { GameView, SeatView } from '@moonveil/protocol';
import { assertOpenBallotsViews, assertOutcome, assertSeatIsolationViews } from '../../apps/server/test/assertions.ts';
import { expect, type Player, test } from '../harness/index.ts';
import { game, runRealMatch } from '../harness/match.ts';
import { seatRealMatchUi, uiBotAct, uiCloseStep, uiPresent } from '../harness/ui.ts';

const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 4152);
const states = (p: Player): SeatView[] => p.frames.flatMap((f) => (f.msg.t === 'state' ? [f.msg.view] : []));

for (const mode of ['automatic', 'moderator'] as const) {
  for (const seats of [7, 8, 9, 10]) {
    test(`UI match, ${mode}, ${seats} browsers: isolation, open ballots, outcome`, async ({ table }) => {
      test.setTimeout(300_000);
      const probe = await table.player('probe', { baseURL: `http://127.0.0.1:${REAL_PORT}` });
      test.skip(!(await uiPresent(probe)), 'game UI not wired in this build (no [data-testid=entry])');
      await probe.context.close();
      const m = await seatRealMatchUi(table, { mode, seats, baseURL: `http://127.0.0.1:${REAL_PORT}` });
      let ballotSteps = 0;
      await runRealMatch(
        m,
        `ui-${mode}-${seats}`,
        async (mm) => {
          const k = game(mm.driver)!.step.kind;
          if (k === 'day.vote' || k === 'day.confirm') {
            await expect(async () => expect(assertOpenBallotsViews(mm.players.map((p) => p.view()))).toBe(true)).toPass({ timeout: 5_000 });
            ballotSteps++;
          }
        },
        200,
        { act: uiBotAct, close: uiCloseStep },
      );
      expect(m.driver.view().status).toBe('ended');
      assertOutcome(game(m.players[0]!) as GameView);
      for (const p of m.players) assertSeatIsolationViews(states(p));
      expect(ballotSteps).toBeGreaterThan(0);
    });
  }
}
