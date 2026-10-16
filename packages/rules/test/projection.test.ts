import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { project, type MatchState, type Projection, type Role, type Viewer } from '../src/index.ts';
import { close, day, match, night, ok, ROLES7, S } from './helpers.ts';

const seat = (n: number): Viewer => ({ kind: 'seat', seat: n });
/** Projection minus fields that legitimately differ by own identity. */
const othersView = (p: Projection) => ({ ...p, me: null });

describe('projection: roles', () => {
  it('each seat sees only own role; wolves also see the pack', () => {
    const s = match();
    for (let v = 0; v < 7; v++) {
      const p = project(s, seat(v));
      for (const sv of p.seats) {
        const entitled = sv.seat === v || (ROLES7[v] === 'wolf' && ROLES7[sv.seat] === 'wolf');
        assert.equal(sv.role, entitled ? ROLES7[sv.seat] : null, `viewer ${v} seat ${sv.seat}`);
      }
      assert.equal(p.moderator, null);
      assert.equal(p.reveal, null);
    }
  });

  it('public viewer sees no roles, no me, no pack', () => {
    const p = project(match(), { kind: 'public' });
    assert.ok(p.seats.every((x) => x.role === null));
    assert.equal(p.me, null);
    assert.equal(p.pack, null);
    assert.deepEqual(p.roleCounts, { wolf: 2, villager: 1, seer: 1, guard: 1, witch: 1, hunter: 1 });
  });

  it('village viewers cannot tell which village seat has which role (role permutation is invisible)', () => {
    const swapped: Role[] = ['wolf', 'wolf', 'hunter', 'guard', 'witch', 'seer', 'villager'];
    const plan = { bite: 6 as const };
    const a = night(match(ROLES7), plan);
    const b = night(match(swapped), plan);
    for (const v of [0, 1, 3, 4]) assert.deepEqual(othersView(project(a, seat(v))), othersView(project(b, seat(v))), `viewer ${v}`);
    assert.deepEqual(project(a, { kind: 'public' }), project(b, { kind: 'public' }));
  });

  it('roles are revealed to everyone at the end; moderator sees all throughout', () => {
    const m = project(match(), { kind: 'moderator' });
    assert.deepEqual(m.seats.map((x) => x.role), ROLES7);
    assert.ok(m.moderator?.nightRec);
    const end = night(match(['wolf', 'villager', 'villager'] as Role[]), { bite: 1 });
    const p = project(end, seat(2));
    assert.deepEqual(p.reveal?.roles, ['wolf', 'villager', 'villager']);
    assert.deepEqual(p.seats.map((x) => x.role), ['wolf', 'villager', 'villager']);
  });
});

describe('projection: night secrets', () => {
  it('night inputs are invisible to non-actors (differential)', () => {
    const base = match();
    let a = ok(base, S(2), { type: 'seer.inspect', seat: 2, target: 0 });
    a = ok(a, S(3), { type: 'guard.protect', seat: 3, target: 6 });
    a = ok(a, S(0), { type: 'wolf.pick', seat: 0, target: 5 });
    let b = ok(base, S(2), { type: 'seer.inspect', seat: 2, target: 6 });
    b = ok(b, S(3), { type: 'guard.protect', seat: 3, target: 4 });
    b = ok(b, S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    for (const v of [4, 5, 6]) assert.deepEqual(project(a, seat(v)), project(b, seat(v)), `viewer ${v}`);
    assert.deepEqual(project(a, { kind: 'public' }), project(b, { kind: 'public' }));
    // Wolves see pack picks but not seer/guard inputs.
    const wa = project(a, seat(1));
    assert.deepEqual(wa.pack?.picks, [5, null, null, null, null, null, null]);
    assert.equal(JSON.stringify(wa).includes('inspect'), false);
  });

  it('seer result goes only to the seer; witch victim only to the witch; pack target only to wolves', () => {
    let s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 0 });
    s = ok(s, S(0), { type: 'wolf.pick', seat: 0, target: 6 });
    s = close(s);
    for (let v = 0; v < 7; v++) {
      const facts = project(s, seat(v)).me?.facts ?? [];
      assert.equal(facts.some((f) => f.k === 'inspect'), v === 2, `inspect for ${v}`);
      assert.equal(facts.some((f) => f.k === 'victim'), v === 4, `victim for ${v}`);
      assert.equal(facts.some((f) => f.k === 'packTarget'), v <= 1, `packTarget for ${v}`);
    }
  });

  it('night death causes are masked publicly; execution is public', () => {
    let s = night(match(), { bite: 6, poison: 3 });
    const p = project(s, seat(2));
    assert.deepEqual(p.seats.filter((x) => !x.alive).map((x) => x.death?.cause), ['night', 'night']);
    s = day(s, 0);
    assert.equal(project(s, seat(2)).seats[0]?.death?.cause, 'executed');
  });

  it('witch dead or alive: the public step sequence is identical (Q11)', () => {
    // a: witch killed night 1; b: villager killed night 1. Night 2 public step views must match.
    const a = close(day(night(match(), { bite: 4 }), 'skip'));
    const b = close(day(night(match(), { bite: 6 }), 'skip'));
    assert.deepEqual(project(a, { kind: 'public' }).step, project(b, { kind: 'public' }).step);
    assert.equal(a.step.kind, 'night.witch');
  });
});

describe('projection: ghosts', () => {
  it('ghost knowledge is frozen at death; no live pack picks; no actions', () => {
    let s = ok(match(), S(2), { type: 'seer.inspect', seat: 2, target: 0 });
    s = night(s, { bite: 2 });
    const atDeath = project(s, seat(2)).me?.facts;
    s = day(s, 'skip');
    s = night(s, { bite: 6, protect: 'pass' });
    const later = project(s, seat(2)).me;
    assert.deepEqual(later?.facts, atDeath);
    assert.deepEqual(later?.actions, []);
    // A dead wolf keeps the pack list but loses live picks and new pack targets.
    let w = day(night(match(), { bite: 'pass' }), 0);
    const factsAtDeath = project(w, seat(0)).me?.facts;
    w = ok(w, S(1), { type: 'wolf.pick', seat: 1, target: 6 });
    const pw = project(w, seat(0));
    assert.deepEqual(pw.pack?.seats, [0, 1]);
    assert.equal(pw.pack?.picks, null);
    w = close(w);
    assert.deepEqual(project(w, seat(0)).me?.facts, factsAtDeath);
  });

  it('dead hunter gets exactly one action: the shot', () => {
    const s = night(match(), { bite: 5 });
    const acts = project(s, seat(5)).me?.actions;
    assert.equal(acts?.length, 1);
    assert.equal(acts?.[0]?.type, 'hunter.shoot');
    assert.deepEqual(project(s, { kind: 'public' }).step, { kind: 'hunter', pending: [5], submitted: [] });
  });
});

describe('projection: actions', () => {
  it('menus match the engine rules', () => {
    const s = match();
    const wolf = project(s, seat(0)).me?.actions[0];
    assert.deepEqual(wolf, { type: 'wolf.pick', targets: [2, 3, 4, 5, 6], canPass: true, current: null });
    const seer = project(s, seat(2)).me?.actions[0];
    assert.deepEqual(seer, { type: 'seer.inspect', targets: [0, 1, 3, 4, 5, 6] });
    assert.deepEqual(project(s, seat(6)).me?.actions, []);
    let g = night(s, { bite: 'pass', protect: 6 });
    g = day(g, 'skip');
    const guard = project(g, seat(3)).me?.actions[0];
    assert.deepEqual(guard, { type: 'guard.protect', targets: [0, 1, 2, 3, 4, 5], current: null });
  });

  it('witch heal menu: canUse false with no victim, absent after use', () => {
    const none = close(match());
    assert.deepEqual(project(none, seat(4)).me?.actions[0], { type: 'witch.heal', canUse: false, current: null });
    let s = night(match(), { bite: 6, heal: true });
    s = close(ok(day(s, 'skip'), S(0), { type: 'wolf.pick', seat: 0, target: 5 }));
    assert.equal(project(s, seat(4)).me?.actions.some((a) => a.type === 'witch.heal'), false);
  });

  it('projection of moderator includes full secrets; seat projection never includes moderator data', () => {
    const s: MatchState = match();
    assert.ok(project(s, { kind: 'moderator' }).moderator);
    for (let v = 0; v < 7; v++) {
      const j = JSON.stringify(project(s, seat(v)));
      assert.equal(j.includes('nightRec'), false);
      assert.equal(j.includes('knowledge'), false);
    }
  });
});
