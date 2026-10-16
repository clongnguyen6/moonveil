// ACCEPTANCE through the game UI (docs/ui/SELECTORS.md): full real-engine matches where every action goes through
// the DOM; assertions stay on each browser's wire. Projects (all browser EMULATION, not real devices):
//   ui-laptop (Desktop Chrome): 7-10 seats, both modes; ui-phone-chromium (Pixel 7) / ui-phone-webkit (iPhone 15): 7 seats.
// Paths covered inside each match: page reload during a vote, network drop at night, ghost UI for dead seats.
// Skips itself until the UI's entry screen exists in the served build (a skip is never a pass).
import type { GameView, SeatView } from '@moonveil/protocol';
import { assertOpenBallotsViews, assertOutcome, assertSeatIsolationViews } from '../../apps/server/test/assertions.ts';
import { ALL_ACCEPTANCE } from '../../apps/server/test/acceptance-seeds.ts';
import { expect, type Player, test } from '../harness/index.ts';
import { type BrowserMatch, game, runRealMatch } from '../harness/match.ts';
import { seatRealMatchUi, uiBotAct, uiCloseStep, uiPresent, uiStats } from '../harness/ui.ts';

const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 4152);
const states = (p: Player): SeatView[] => p.frames.flatMap((f) => (f.msg.t === 'state' ? [f.msg.view] : []));
const isPhone = (name: string) => name.startsWith('ui-phone');
const STRICT = process.env.E2E_UI_STRICT === '1';
const ACTION_CONTROLS = ['confirm', 'vote-skip', 'vote-yes', 'vote-no', 'heal-yes', 'heal-no'];

// On a failed ghost check: what the wire says vs which hooks the page shows.
async function ghostDiag(p: Player): Promise<string> {
  const g = game(p) as GameView;
  const ids = await p.page.locator('[data-testid]').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('data-testid')}${(e as HTMLButtonElement).disabled ? '[disabled]' : ''}`),
  );
  return JSON.stringify({ seat: g.me?.seat, role: g.me?.role, alive: g.me?.alive, step: g.step.kind, actions: g.me?.actions.map((a) => a.type), domTestIds: ids.slice(0, 80) });
}

async function resumed(p: Player, seat: string) {
  await expect(p.page.locator('[data-testid=conn][data-status=open]')).toHaveCount(1, { timeout: 20_000 });
  await expect(p.page.getByTestId('room')).toHaveAttribute('data-status', 'playing');
  expect(p.view().me.seat).toBe(seat);
}

for (const seed of ALL_ACCEPTANCE) {
  const { mode, seats } = seed;
  {
    test(`UI match, ${mode}, ${seats} browsers, seed ${seed.S} (${seed.expect.winner}/${seed.expect.reason}): reload + network drop, ghosts, open ballots, isolation, outcome`, async ({ table }, info) => {
      test.skip(isPhone(info.project.name) && seats !== 7, 'phone projects run 7 seats');
      test.setTimeout(isPhone(info.project.name) ? 900_000 : 600_000);
      const probe = await table.player('probe', { baseURL: `http://127.0.0.1:${REAL_PORT}` });
      test.skip(!(await uiPresent(probe)), 'game UI not wired in this build (no [data-testid=entry])');
      await probe.context.close();

      let outcome: unknown = null;
      uiStats.attempted = uiStats.done = 0;
      uiStats.misses = [];
      uiStats.byType = {};
      uiStats.wolfPicks = [];
      const stats = { ballotSteps: 0, reloads: 0, reloadMs: 0, ballotRecheckAfterReload: '', drops: 0, ghostChecks: 0, overflowChecks: 0, wolfPicksChecked: 0 };
      const report = (result: string) =>
        console.log(`UIMATCH ${JSON.stringify({ project: info.project.name, mode, seats, seed: seed.S, expected: seed.expect, outcome, result, strict: STRICT, landed: uiStats.done, intended: uiStats.attempted, byType: uiStats.byType, misses: uiStats.misses, ...stats })}`);
      try {
      const m = await seatRealMatchUi(table, { mode, seats, baseURL: `http://127.0.0.1:${REAL_PORT}`, hostName: seed.S });
      await runRealMatch(
        m,
        seed.S,
        async (mm: BrowserMatch) => {
          const k = game(mm.driver)!.step.kind;
          const living = mm.players.filter((p) => game(p)!.me!.alive);
          const isVote = (kind: string) => kind === 'day.vote' || kind === 'day.confirm';
          // Open ballots first (the vote is short at low time scales), then the reload path.
          if (isVote(k)) {
            await expect(async () => expect(assertOpenBallotsViews(mm.players.map((p) => p.view()))).toBe(true)).toPass({ timeout: 5_000 });
            stats.ballotSteps++;
          }
          // Reconnect path 1: a living seat reloads its page during the first vote.
          if (isVote(k) && stats.reloads === 0 && living.length > 1) {
            const p = living[living.length - 1]!;
            const seat = p.seat;
            const t0 = Date.now();
            await p.page.reload();
            await resumed(p, seat);
            stats.reloadMs = Date.now() - t0;
            stats.reloads++;
            // Re-check with the reloaded seat if the vote is still open; else record that it had closed.
            if (isVote(game(mm.driver)!.step.kind)) {
              await expect(async () => expect(assertOpenBallotsViews(mm.players.map((x) => x.view()))).toBe(true)).toPass({ timeout: 5_000 });
              stats.ballotRecheckAfterReload = 'checked';
            } else stats.ballotRecheckAfterReload = 'vote closed before resume';
          }
          // Reconnect path 2: a living seat loses its network for 3 s at the first night.
          if (k === 'night.main' && stats.drops === 0 && living.length > 2) {
            const p = living[1]!;
            const seat = p.seat;
            await p.dropNetwork(3_000);
            await resumed(p, seat);
            stats.drops++;
          }
          // Ghost path: dead seats show the ghost bar and no action controls.
          for (const p of mm.players.filter((x) => !game(x)!.me!.alive && game(x)!.step.kind !== 'hunter')) {
            try {
              await expect(p.page.getByTestId('ghost-bar')).toBeVisible();
              // Ghosts cannot act: no ENABLED action control (a disabled panel may be shown).
              const enabled = p.page.locator(ACTION_CONTROLS.map((id) => `[data-testid=${id}]:not([disabled])`).join(','));
              await expect(enabled).toHaveCount(0);
            } catch (e) {
              throw new Error(`ghost check failed for ${p.name}: ${await ghostDiag(p)}\n${(e as Error).message.split('\n')[0]}`);
            }
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
        seats + 3, // acceptance: win condition within seats + 3 days
      );
      expect(m.driver.view().status).toBe('ended');
      const final = game(m.players[0]!) as GameView;
      outcome = final.outcome;
      assertOutcome(final);
      expect(final.outcome, `acceptance seed ${seed.S}`).toEqual(seed.expect);
      // Night actions reach the engine: every accepted wolf pick (last per wolf per night) is in that night's record.
      const nights = (final.reveal?.history ?? []).flatMap((h) => (h.t === 'night' ? [h] : []));
      const last = new Map(uiStats.wolfPicks.map((w) => [`${w.night}/${w.seat}`, w]));
      for (const w of last.values()) {
        const rec = nights.find((n) => n.night === w.night)?.record;
        expect(rec?.wolfPicks[w.seat], `night ${w.night}: wolf seat ${w.seat} pick ${w.target} missing from the night record`).toBe(w.target);
      }
      stats.wolfPicksChecked = last.size;
      for (const p of m.players) assertSeatIsolationViews(states(p));
      expect(uiStats.done, 'UI actions performed').toBeGreaterThan(0);
      // Acceptance (E2E_UI_STRICT=1): every intended UI action must land. Quick runs: at least 80%.
      if (STRICT) expect(uiStats.misses, 'UI actions that did not land').toEqual([]);
      else expect(uiStats.done / uiStats.attempted, 'share of UI actions that landed').toBeGreaterThanOrEqual(0.8);
      report('passed');
      } catch (e) {
        report(`failed: ${String((e as Error).message).split('\n')[0]!.slice(0, 400)}`);
        throw e;
      }
      expect(stats.ballotSteps).toBeGreaterThan(0);
      expect(stats.reloads + stats.drops).toBeGreaterThan(0);
    });
  }
}
