// ACCEPTANCE (protocol-driven until the game UI is wired): full matches with the REAL rules engine,
// 7-10 browser sessions, both modes. Server time x20 (TEST ONLY); approved timings unchanged in engine time.
// Asserts on the wire of every browser: isolation, open day ballots, wolf chat isolation, outcome.
import type { GameView, SeatView } from '@moonveil/protocol';
import { assertOpenBallotsViews, assertOutcome, assertSeatIsolationViews } from '../../apps/server/test/assertions.ts';
import { ALL_ACCEPTANCE } from '../../apps/server/test/acceptance-seeds.ts';
import { expect, type Player, test } from '../harness/index.ts';
import { game, protocolActor, runRealMatch, seatRealMatch, send } from '../harness/match.ts';

const REAL_PORT = Number(process.env.E2E_REAL_PORT ?? 4152);
const states = (p: Player): SeatView[] => p.frames.flatMap((f) => (f.msg.t === 'state' ? [f.msg.view] : []));
const VOICE = Boolean(process.env.LIVEKIT_PUBLIC_WS);

// Voice wire (E2E_VOICE=1): every `voice` frame carries only sessions for channels the seat may listen to
// (per its latest state before that frame), each token is bound to this seat and that session's room,
// and no token ever appears in a `state` frame. Returns the number of sessions checked.
function assertVoiceWire(p: Player): number {
  let latest: SeatView | null = null;
  let checked = 0;
  const tokens: string[] = [];
  for (const f of p.frames) {
    if (f.msg.t === 'state') latest = f.msg.view;
    if (f.msg.t !== 'voice') continue;
    const listen = new Set((latest?.voice ?? []).filter((g) => g.listen).map((g) => g.channel));
    for (const s of f.msg.sessions) {
      expect(listen.has(s.channel), `${p.name}: session for ungranted channel ${s.channel}`).toBe(true);
      const claims = JSON.parse(Buffer.from(s.token.split('.')[1]!, 'base64url').toString('utf8')) as { sub: string; video?: { room?: string } };
      expect(claims.sub).toBe(latest!.me.seat);
      expect(claims.video?.room).toBe(s.room);
      tokens.push(s.token);
      checked++;
    }
  }
  for (const f of p.frames) if (f.msg.t === 'state') for (const t of tokens) expect(f.raw.includes(t), 'token inside a state frame').toBe(false);
  return checked;
}

for (const seed of ALL_ACCEPTANCE) {
  const { mode, seats } = seed;
  {
    test(`real match, ${mode}, ${seats} browsers, seed ${seed.S} (${seed.expect.winner}/${seed.expect.reason}): isolation, open ballots, wolf chat, outcome`, async ({ table }) => {
      test.setTimeout(240_000);
      const m = await seatRealMatch(table, { mode, seats, baseURL: `http://127.0.0.1:${REAL_PORT}`, hostName: seed.S });
      let ballotSteps = 0;
      let wolfChat = false;
      await runRealMatch(m, seed.S, async (mm) => {
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
      }, 200, protocolActor, seats + 3); // acceptance: win condition within seats + 3 days
      expect(m.driver.view().status).toBe('ended');
      const finals = m.players.map((p) => game(p) as GameView);
      assertOutcome(finals[0]!);
      expect(finals[0]!.outcome, `acceptance seed ${seed.S}`).toEqual(seed.expect);
      for (const f of finals) expect(f.outcome).toEqual(finals[0]!.outcome);
      for (const p of m.players) {
        assertSeatIsolationViews(states(p));
        if (game(p)!.me!.role !== 'wolf') expect(p.frames.some((f) => f.raw.includes(`pack-${mode}-${seats}`))).toBe(false);
      }
      if (m.moderator) expect(game(m.moderator)!.moderator).not.toBeNull();
      if (VOICE) {
        const sessions = [...m.players, ...(m.moderator ? [m.moderator] : [])].reduce((n, p) => n + assertVoiceWire(p), 0);
        expect(sessions, 'voice sessions observed').toBeGreaterThan(0);
      }
      console.log(`MATCH ${JSON.stringify({ mode, seats, seed: seed.S, expected: seed.expect, steps: m.steps, ballotSteps, wolfChat, outcome: finals[0]!.outcome })}`);
      expect(ballotSteps).toBeGreaterThan(0);
    });
  }
}
