// Value noise + fBm. PURE. Used by the painters for ground texture, canopy edges, mist and grain.
import { Rng } from './rng.ts';

export class Noise {
  private perm: Uint8Array;
  constructor(seed: number) {
    const rng = new Rng(seed);
    const p = new Uint8Array(512);
    const base = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [base[i], base[j]] = [base[j]!, base[i]!]; }
    for (let i = 0; i < 512; i++) p[i] = base[i & 255]!;
    this.perm = p;
  }
  private hash(ix: number, iy: number): number {
    return this.perm[(this.perm[ix & 255]! + iy) & 255]! / 255;
  }
  // smooth value noise in [0,1]
  value(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = this.hash(ix, iy), b = this.hash(ix + 1, iy), c = this.hash(ix, iy + 1), d = this.hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  // fractal sum, roughly [0,1]
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += this.value(x * freq, y * freq) * amp; norm += amp; amp *= gain; freq *= lacunarity; }
    return sum / norm;
  }
}
