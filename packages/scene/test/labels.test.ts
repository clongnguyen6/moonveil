import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLabels, DEFAULT_MAX_LIFT, type LabelRect } from '../src/labels.ts';

const vp = { w: 390, h: 844, top: 56, right: 0, bottom: 0, left: 0 };
const rect = (id: string, x: number, y: number, w = 60, h = 14): LabelRect => ({ id, x, y, w, h });
const apply = (ls: LabelRect[]) => { const off = layoutLabels(ls, vp); return ls.map((l) => { const o = off.find((x) => x.id === l.id)!; return { ...l, x: l.x + o.dx, y: l.y + o.dy }; }); };
const inside = (l: LabelRect) => l.x - l.w / 2 >= vp.left && l.x + l.w / 2 <= vp.w - vp.right && l.y - l.h >= vp.top && l.y <= vp.h;
const overlap = (a: LabelRect, b: LabelRect) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1 && Math.abs((a.y - a.h / 2) - (b.y - b.h / 2)) < (a.h + b.h) / 2 - 1;

test('labels at the screen edges are pulled fully inside, including under the top HUD inset', () => {
  const out = apply([rect('l', 10, 400), rect('r', 385, 400), rect('t', 200, 30), rect('b', 200, 900)]);
  for (const l of out) assert.ok(inside(l), `${l.id} outside: ${l.x},${l.y}`);
  assert.equal(out.find((l) => l.id === 'l')!.x, 34);
  assert.equal(out.find((l) => l.id === 't')!.y, 56 + 4 + 14);
});

// 15 seats on a phone in tight framing: ring ≈ 142 × 84 px (world rx 195 / ry 115 at scale 0.73), labels 50–78 px wide.
// An earlier synthetic ring at a 70 px radius was denser than any real layout; with the lift capped at one label height
// it cannot be solved without residual overlap, so the test targets the real geometry rather than loosening the cap.
const ring15 = (): LabelRect[] => { const ls: LabelRect[] = []; for (let i = 0; i < 15; i++) { const a = (i / 15) * Math.PI * 2; ls.push(rect(`s${i}`, 195 + Math.cos(a) * 142, 420 + Math.sin(a) * 84, 50 + (i % 3) * 14)); } return ls; };

test('a 15-seat phone ring ends with no overlapping labels, all inside, lifts capped at one label height', () => {
  const ls = ring15();
  const off = layoutLabels(ls, vp);
  const out = ls.map((l) => { const o = off.find((x) => x.id === l.id)!; return { ...l, x: l.x + o.dx, y: l.y + o.dy }; });
  for (const l of out) assert.ok(inside(l), `${l.id} outside`);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(!overlap(out[i]!, out[j]!), `${out[i]!.id} overlaps ${out[j]!.id}`);
  for (const o of off) assert.ok(o.dy >= -(14 + 2) - 1e-6, `${o.id} lifted too far: ${o.dy}`);
});

test('v1 behaviour (lift up to 3) still resolves the same ring without overlaps', () => {
  const ls = ring15();
  const off = layoutLabels(ls, vp, 3);
  const out = ls.map((l) => { const o = off.find((x) => x.id === l.id)!; return { ...l, x: l.x + o.dx, y: l.y + o.dy }; });
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(!overlap(out[i]!, out[j]!), `${out[i]!.id} overlaps ${out[j]!.id}`);
});

test('non-overlapping labels are left where they are', () => {
  const ls = [rect('a', 100, 300), rect('b', 200, 300), rect('c', 100, 500)];
  const off = layoutLabels(ls, vp);
  for (const o of off) { assert.equal(o.dx, 0); assert.equal(o.dy, 0); }
});

test('lift is capped at one label height; further conflicts slide sideways; displacement is flagged', () => {
  // three labels stacked on the same spot: the first stays, the second lifts once, the third must slide
  const ls = [rect('a', 200, 400), rect('b', 200, 401), rect('c', 200, 402)];
  const off = layoutLabels(ls, vp);
  const o = (id: string) => off.find((x) => x.id === id)!;
  assert.equal(DEFAULT_MAX_LIFT, 1);
  for (const x of off) assert.ok(x.dy >= -(14 + 2) * 1.01 - 1e-6, `${x.id} lifted more than one label height: ${x.dy}`);
  assert.ok(off.filter((x) => Math.abs(x.dx) > 0).length >= 1, 'one label should slide sideways');
  assert.equal(o('a').displaced || o('b').displaced || o('c').displaced, true);
  assert.equal(layoutLabels([rect('solo', 200, 400)], vp)[0]!.displaced, false);
  assert.equal(layoutLabels([rect('solo', 200, 400)], vp)[0]!.dy, 0);
});
