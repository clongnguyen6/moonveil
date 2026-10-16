// UI owner proposals P2/P3/P5 as implemented by foundation (docs/architecture/0005-ui-proposals.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRulesEngine } from '@moonveil/rules';
import type { RulesEngine } from '../src/rules/engine.ts';
import { profile, setup } from './harness.ts';

const real = (seed: string) => setup({ engine: () => createRulesEngine() as RulesEngine<unknown>, seed });

test('P3 inPerson: no voice grants ever reach the gateway; text still follows grants', () => {
  const h = real('p3');
  const host = h.client();
  host.send({ t: 'create', mode: 'automatic', profile: profile('P0'), voiceMode: 'inPerson' });
  const ps = [host];
  for (let i = 1; i < 8; i++) {
    const c = h.client();
    c.send({ t: 'join', code: host.code!, profile: profile(`P${i}`) });
    ps.push(c);
  }
  for (const p of ps) p.send({ t: 'ready', ready: true });
  host.send({ t: 'start' });
  assert.equal(host.view.voiceMode, 'inPerson');
  for (const p of ps) assert.deepEqual(h.voice.grants.get(`${host.code}/${p.seat}`), [], 'voice grant issued in-person');
  assert.ok(ps.some((p) => p.view.voice.length > 0), 'text grants still present');
  const wolf = ps.find((p) => (p.view.game as { me: { role: string } }).me.role === 'wolf')!;
  wolf.send({ t: 'say', channel: 'wolves', text: 'text works' });
  assert.ok(wolf.frames.some((f) => f.t === 'chat'));
});

test('P3 default is remote; voice grants follow channels', () => {
  const h = real('p3-remote');
  const { creator } = h.room('automatic', 8);
  assert.equal(creator.view.voiceMode, 'remote');
  assert.deepEqual(h.voice.grants.get(`${creator.code}/${creator.seat}`), [{ channel: 'public', listen: true, speak: true }]);
});

test('P5: phaseDurationMs is static per phase and survives a pause; state/hb carry server now', () => {
  const h = real('p5');
  const { creator, players } = h.room('automatic', 8);
  creator.send({ t: 'start' });
  assert.equal(creator.view.phaseDurationMs, 40_000);
  const frame = creator.frames.filter((f) => f.t === 'state').at(-1)!;
  assert.ok(frame.t === 'state' && frame.now === h.clock.now());
  h.clock.tick(10_000);
  for (const p of players) p.drop();
  h.clock.tick(5_000);
  const back = h.client();
  back.send({ t: 'resume', code: creator.code!, token: players[2]!.token! });
  assert.equal(back.view.phaseDurationMs, 40_000);
  assert.equal(back.view.phaseEndsAt! - h.clock.now(), 30_000, 'remaining preserved');
});

test('P2: chat messages carry the sender name; 500-char limit', () => {
  const h = real('p2');
  const { players } = h.room('automatic', 3);
  players[0]!.send({ t: 'say', channel: 'public', text: 'x'.repeat(500) });
  const m = players[1]!.frames.find((f) => f.t === 'chat');
  assert.ok(m && m.t === 'chat' && m.msg.name === 'P0' && m.msg.text.length === 500);
  assert.throws(() => players[0]!.send({ t: 'say', channel: 'public', text: 'x'.repeat(501) }));
});
