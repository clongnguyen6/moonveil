// Seeded RNG so layouts and captures are reproducible. Pure.
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: readonly T[]): T { const v = arr[Math.floor(this.next() * arr.length)]; if (v === undefined) throw new Error('pick from empty'); return v; }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const smooth = (t: number): number => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

export function hsl(h: number, s: number, l: number): number {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
export function mixColor(a: number, b: number, t: number): number {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
export function shade(c: number, f: number): number {
  const r = clamp(Math.round((c >> 16) * f), 0, 255);
  const g = clamp(Math.round(((c >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((c & 255) * f), 0, 255);
  return (r << 16) | (g << 8) | b;
}
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
