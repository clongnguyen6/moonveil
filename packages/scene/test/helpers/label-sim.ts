// Node simulation of the scene's label pass (scene.ts layoutNameLabels): camera from framing.ts, living labels through
// labels.ts layoutLabels, memorial names through memorial.ts placeMemorialLabel. Label sizes estimated from the font.
import { createMap, type MapLayout } from '../../src/map.ts';
import { frameCamera } from '../../src/framing.ts';
import { layoutLabels, type LabelRect } from '../../src/labels.ts';
import { memorialSpots, placeMemorialLabel, type Rect } from '../../src/memorial.ts';
import { seatBox } from '../../src/boxes.ts';
import { NAMES } from '../../fixtures/index.ts';

export interface SimView { name: string; w: number; h: number; top: number; bottom: number; whole?: boolean }
export const VIEWS: SimView[] = [
  { name: 'phone-375x667', w: 375, h: 253, top: 56, bottom: 64 },
  { name: 'phone-390x844', w: 390, h: 428, top: 56, bottom: 0 },
  { name: 'laptop-1440x900', w: 1000, h: 900, top: 56, bottom: 0 },
  { name: 'phone-390x844-whole-camp', w: 390, h: 428, top: 56, bottom: 0, whole: true },
];
export interface SimResult { living: Rect[]; heads: Rect[]; stones: Rect[]; names: (Rect | null)[]; dead: number[] }

export function simulate(n: number, dead: number[], v: SimView, place = true, naive = false): SimResult {
  const map: MapLayout = createMap(n);
  const innerH = v.h - v.top - v.bottom;
  const f = frameCamera(map, v.whole ? 'lobby' : 'day', v.w, innerH, null, v.bottom === 0);   // as scene.ts: no bottom band when the UI passes a bottom safe area
  const sc = f.scale, camX = v.w / 2 - f.cx * sc, camY = v.top + innerH / 2 - f.cy * sc;
  const S = (b: { x0: number; y0: number; x1: number; y1: number }): Rect => ({ x0: camX + b.x0 * sc, y0: camY + b.y0 * sc, x1: camX + b.x1 * sc, y1: camY + b.y1 * sc });
  const labelScale = Math.min(3.2, Math.max(1, 1 / sc)) * (sc < 0.65 && !f.focus ? 0.8 : 1);
  const px = (n >= 13 ? 11 : 12) * labelScale * sc;   // on-screen font size
  const size = (name: string) => ({ w: name.length * px * 0.62 + 6, h: px * 1.35 });
  const view = { w: v.w, h: v.h, top: v.top, right: 0, bottom: v.bottom, left: 0 };
  const living = map.seats.map((s, i) => ({ s, i })).filter(({ i }) => !dead.includes(i));
  const rects: LabelRect[] = living.map(({ s, i }) => { const z = size(NAMES[i]!); return { id: String(i), x: camX + s.sit.x * sc, y: camY + (s.sit.y - 78) * sc, ...z }; });
  const spots0 = memorialSpots(map), stones0 = dead.map((i) => S(spots0[i]!.box));
  const out = layoutLabels(rects, view, undefined, stones0);
  const livingRects = out.map((o) => { const r = rects.find((x) => x.id === o.id)!; return { x0: r.x - r.w / 2 + o.dx, y0: r.y - r.h + o.dy, x1: r.x + r.w / 2 + o.dx, y1: r.y + o.dy }; });
  const heads = living.map(({ s }) => S(seatBox({ x: s.sit.x, y: s.sit.y })));
  const spots = memorialSpots(map);
  const stones = dead.map((i) => S(spots[i]!.box));
  const placed: Rect[] = [...livingRects, ...heads, ...stones];
  const names = dead.map((i, k) => {
    if (!place) return null;
    const z = size(NAMES[i]!); const p = placeMemorialLabel(stones[k]!, z.w, z.h, naive ? [] : placed, view);   // naive: negative control
    if (p) placed.push(p.rect);
    return p?.rect ?? null;
  });
  return { living: livingRects, heads, stones, names, dead };
}
export const hit = (a: Rect, b: Rect, pad = 0) => a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;
export const DEAD_SETS = (n: number) => [[1], [1, 2], Array.from({ length: n }, (_, i) => i).filter((i) => i % 3 === 1), Array.from({ length: n - 2 }, (_, i) => i + 2)];
