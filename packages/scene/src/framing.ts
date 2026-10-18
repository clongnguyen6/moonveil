// Camera framing for the 'fit' camera. PURE. The whole camp by default; on small slots during play (camp fit below
// FOCUS_BELOW: phones) the area that matters is framed instead, so seats and names stay readable:
// day/ended = the seat ring, night = tents + fire. A free-moving local ghost always stays in frame.
import { frameRect, type MapLayout, type Pt } from './map.ts';
import type { Phase } from './types.ts';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Framing { scale: number; cx: number; cy: number; focus: boolean }

export const FOCUS_BELOW = 0.45;   // camp-fit scale under which focus framing applies (laptops fit the camp above it)
export const FOCUS_MAX = 0.65;     // never zoom in further than this (labels stay at their full 12 px from here)
const MIN_GAIN = 1.1;              // focus only when it enlarges the view by at least 10 %
// The camp frame keeps 25.7 % of its height below the seat ring; the UI relies on it for the phone chat row and passes
// the row as a bottom safe area only when it covers more. Focus framing keeps the same band free unless a bottom
// safe area is set (MOUNT.md).
export const BOTTOM_BAND = 0.26;

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const around = (pts: readonly Pt[], left: number, right: number, up: number, down: number): Rect =>
  pts.map((p) => ({ x: p.x - left, y: p.y - up, w: left + right, h: up + down })).reduce(union);

// Seated campers incl. name labels and tall headgear (label anchor up to ~-100, label ~25 units at focus scale).
export function seatsRect(map: MapLayout): Rect { return around(map.seats, 70, 70, 140, 25); }
export function nightRect(map: MapLayout): Rect { return union(around(map.tents, 70, 70, 100, 30), seatsRect(map)); }
const cache = new WeakMap<MapLayout, { seats: Rect; night: Rect }>();   // per map, not per frame

export function focusRect(map: MapLayout, phase: Phase, ghostAt: Pt | null): Rect | null {
  if (phase === 'lobby') return null;
  let c = cache.get(map); if (!c) { c = { seats: seatsRect(map), night: nightRect(map) }; cache.set(map, c); }
  const r = phase === 'night' ? c.night : c.seats;
  return ghostAt ? union(r, around([ghostAt], 50, 50, 130, 25)) : r;
}

export function frameCamera(map: MapLayout, phase: Phase, innerW: number, innerH: number, ghostAt: Pt | null = null, keepBand = true): Framing {
  const fr = frameRect(map);
  const fit = Math.min(innerW / fr.w, innerH / fr.h);
  const camp: Framing = { scale: fit, cx: fr.x + fr.w / 2, cy: fr.y + fr.h / 2, focus: false };
  if (fit >= FOCUS_BELOW) return camp;
  const f = focusRect(map, phase, ghostAt);
  if (!f) return camp;
  const band = keepBand ? BOTTOM_BAND * innerH : 0, h = innerH - band;
  const fs = Math.min(innerW / f.w, h / f.h);
  if (fs < fit * MIN_GAIN) return camp;   // little to gain (e.g. night, 10 tents, narrow portrait slot): keep the camp exactly
  const scale = Math.min(fs, FOCUS_MAX);
  // centre the rect in the area above the band (the camera centres the view on cy)
  return { scale, cx: f.x + f.w / 2, cy: f.y + f.h / 2 + band / 2 / scale, focus: true };
}
