import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLabels, type LabelRect } from '../src/labels.ts';

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

test('a dense seat ring (15 labels) ends with no overlapping labels and all inside', () => {
  const ls: LabelRect[] = [];
  for (let i = 0; i < 15; i++) { const a = (i / 15) * Math.PI * 2; ls.push(rect(`s${i}`, 195 + Math.cos(a) * 70, 420 + Math.sin(a) * 40, 50 + (i % 3) * 14)); }
  const out = apply(ls);
  for (const l of out) assert.ok(inside(l), `${l.id} outside`);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(!overlap(out[i]!, out[j]!), `${out[i]!.id} overlaps ${out[j]!.id}`);
});

test('non-overlapping labels are left where they are', () => {
  const ls = [rect('a', 100, 300), rect('b', 200, 300), rect('c', 100, 500)];
  const off = layoutLabels(ls, vp);
  for (const o of off) { assert.equal(o.dx, 0); assert.equal(o.dy, 0); }
});
