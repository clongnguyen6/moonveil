// ACCEPTANCE (protocol-driven until the game UI is wired): full matches with the REAL rules engine,
// 7-10 browser sessions, both modes. Server time x20 (TEST ONLY); approved timings unchanged in engine time.
// Asserts on the wire of every browser: isolation, open day ballots, wolf chat isolation, outcome.
import type { GameView, SeatView } from '@moonveil/protocol';
import { assertOpenBallotsViews, assertOutcome, assertSeatIsolationViews } from '../../apps/server/test/assertions.ts';
import { expect, type Player, test } from '../harness/index.ts';
import { game, runRealMatch, seatRealMatch, send } from '../harness/match.ts';

const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 4152);
const states = (p: Player): SeatView[] => p.frames.flatMap((f) => (f.msg.t === 'state' ? [f.msg.view] : []));

for (const mode of ['automatic', 'moderator'] as const) {
  for (const seats of [7, 8, 9, 10]) {
    test(`real match, ${mode}, ${seats} browsers: isolation, open ballots, wolf chat, outcome`, async ({ table }) => {
      test.setTimeout(240_000);
      const m = await seatRealMatch(table, { mode, seats, baseURL: `http://127.0.0.1:${REAL_PORT}` });
      let ballotSteps = 0;
      let wolfChat = false;
      await runRealMatch(m, `${mode}-${seats}`, async (mm) => {
        const g = game(mm.driver)!;
        if (g.step.kind === 'day.vote' || g.step.kind === 'day.confirm') {
          // Open ballots: every seat sees the same voter->choice map, own slot = own ballot.
          await expect(async () => expect(assertOpenBallotsViews(mm.players.map((p) => p.view()))).toBe(true)).toPass({ timeout: 5_000 });
          ballotSteps++;
        }
        if (!wolfChat && g.step.kind === 'night.main') {
          const wolves = mm.players.filter((p) => game(p)!.me!.role === 'wolf' && game(p)!.me!.alive);
          if (wolves.length > 0) {
            const text = `pack-${mode}-${seats}`;
            await send(wolves[0]!, { t: 'say', channel: 'wolves', text });
            for (const w of wolves) await expect.poll(() => w.frames.some((f) => f.raw.includes(text))).toBe(true);
            wolfChat = true;
          }
        }
      });
      expect(m.driver.view().status).toBe('ended');
      const finals = m.players.map((p) => game(p) as GameView);
      assertOutcome(finals[0]!);
      for (const f of finals) expect(f.outcome).toEqual(finals[0]!.outcome);
      for (const p of m.players) {
        assertSeatIsolationViews(states(p));
        if (game(p)!.me!.role !== 'wolf') expect(p.frames.some((f) => f.raw.includes(`pack-${mode}-${seats}`))).toBe(false);
      }
      if (m.moderator) expect(game(m.moderator)!.moderator).not.toBeNull();
      console.log(`MATCH ${JSON.stringify({ mode, seats, steps: m.steps, ballotSteps, wolfChat, outcome: finals[0]!.outcome })}`);
      expect(ballotSteps).toBeGreaterThan(0);
    });
  }
}
