// Pure match assertions over seat snapshots. Shared by server tests (FakeClient) and the browser e2e harness
// (wire frames). No server imports: node:assert + protocol types only.
import assert from 'node:assert/strict';
import type { GameView, SeatView } from '@moonveil/protocol';

const gameOf = (v: SeatView) => v.game as GameView | null;

// One seat's snapshots over time: identity/role stable; before the end no moderator data, pack only for wolves,
// other roles only if wolf-mates or publicly revealed (Q20).
export function assertSeatIsolationViews(views: readonly SeatView[]) {
  const all = views.map(gameOf).filter((g): g is GameView => g !== null);
  if (all.length === 0) return;
  const me = all[0]!.me!;
  for (const g of all) {
    assert.equal(g.me!.seat, me.seat, 'identity stable');
    assert.equal(g.me!.role, me.role, 'role stable');
    if (g.step.kind === 'ended') continue;
    assert.equal(g.moderator, null, `seat ${me.seat} got moderator data`);
    if (me.role !== 'wolf') assert.equal(g.pack, null, `seat ${me.seat} got pack view`);
    const revealed = new Set(g.publicLog.flatMap((e) => (e.t === 'roleRevealed' ? [e.seat] : [])));
    const wolves = new Set(g.pack?.seats ?? []);
    for (const s of g.seats) {
      if (s.role === null || s.seat === me.seat || revealed.has(s.seat)) continue;
      assert.ok(me.role === 'wolf' && wolves.has(s.seat) && s.role === 'wolf', `seat ${me.seat} learned role of ${s.seat}`);
    }
  }
}

// Open day ballots (approved): latest snapshot of every seat at one moment. Returns true if a vote step was checked.
export function assertOpenBallotsViews(latest: readonly SeatView[]): boolean {
  const views = latest.map(gameOf).filter((g): g is GameView => g !== null);
  const st = views[0]?.step as { kind: string; votes?: unknown } | undefined;
  if (!st || (st.kind !== 'day.vote' && st.kind !== 'day.confirm')) return false;
  const ref = JSON.stringify(st.votes ?? null);
  assert.notEqual(ref, 'null', `ballots hidden during ${st.kind}`);
  for (const g of views) {
    assert.equal(JSON.stringify((g.step as { votes?: unknown }).votes ?? null), ref, `seat ${g.me?.seat} sees different ballots`);
    if (!g.me) continue;
    const votes = (g.step as { votes: unknown[] }).votes;
    assert.deepEqual(votes[g.me.seat] ?? null, (g.me as { ballot?: unknown }).ballot ?? null, `seat ${g.me.seat}: own ballot`);
  }
  return true;
}

// Final outcome consistent with the approved win conditions (+ Q14 zero survivors = draw, rules-12 stalemate draw).
export function assertOutcome(final: GameView) {
  assert.ok(final.outcome, 'outcome set');
  const roles = final.reveal!.roles;
  const alive = final.seats.filter((s) => s.alive);
  const lw = alive.filter((s) => roles[s.seat] === 'wolf').length;
  const lv = alive.length - lw;
  switch (final.outcome.winner) {
    case 'wolves':
      assert.ok(lw > 0 && lw >= lv, `wolves win needs parity: ${lw} vs ${lv}`);
      break;
    case 'village':
      assert.ok(lw === 0 && lv > 0, `village win needs no wolves: ${lw} vs ${lv}`);
      break;
    case 'draw':
      // Q14 zero survivors, or rules-12 F1-A stalemate (three consecutive cycles without a death).
      if (final.outcome.reason === 'stalemate') {
        assert.ok(final.publicLog.some((e) => e.t === ('stalemateWarning' as string)), 'stalemate draw without a prior warning');
      } else assert.equal(alive.length, 0, 'draw = zero survivors');
      break;
    default:
      assert.fail(`unexpected winner ${final.outcome.winner}`);
  }
}
