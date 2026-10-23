// Death beat effect: a faint pale wisp at a tent or seat (public: the projection says the seat died). Not a ghost pose.
// high: a few soft puffs rise ~50 units and fade over 1.6 s. Reduced motion: one static puff fading over 1 s. low: none.
// Emissive layer (below the label layer). No cost when idle.
import { Container, Sprite, type Texture } from 'pixi.js';
import type { Pt } from './map.ts';

export type WispMode = 'rise' | 'static' | 'off';
interface Puff { s: Sprite; x: number; y: number; t: number; life: number; rise: number; sway: number; peak: number }

export class Wisps {
  private layer: Container; private tex: Texture; private mode: WispMode;
  private puffs: Puff[] = [];
  constructor(layer: Container, tex: Texture, mode: WispMode) { this.layer = layer; this.tex = tex; this.mode = mode; }

  spawn(at: Pt) {
    if (this.mode === 'off') return;
    const n = this.mode === 'rise' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.tex); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xe4ecff; s.alpha = 0; s.scale.set(0.5 - i * 0.1);
      this.layer.addChild(s);
      this.puffs.push({ s, x: at.x + (i - 1) * 6, y: at.y, t: -i * 0.18, life: this.mode === 'rise' ? 1.6 : 1.0, rise: this.mode === 'rise' ? 50 : 0, sway: this.mode === 'rise' ? 5 : 0, peak: 0.55 - i * 0.12 });
    }
  }

  get active(): number { return this.puffs.length; }

  update(dt: number) {
    if (!this.puffs.length) return;
    for (const p of this.puffs) {
      p.t += dt;
      const u = Math.max(0, Math.min(1, p.t / p.life));
      p.s.position.set(p.x + Math.sin(u * 6) * p.sway, p.y - p.rise * u);
      p.s.alpha = p.t < 0 ? 0 : p.peak * (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8);
    }
    this.puffs = this.puffs.filter((p) => { if (p.t < p.life) return true; p.s.destroy(); return false; });
  }

  destroy() { for (const p of this.puffs) p.s.destroy(); this.puffs = []; }
}
