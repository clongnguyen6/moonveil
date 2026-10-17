// Fire, embers, smoke, mist, moon glints for direction-2: restrained, no bloom. Pools of sprites, no filters.
import { Container, Sprite, type Texture } from 'pixi.js';
import { Rng, lerp, clamp } from './rng.ts';
import type { TextureBank } from './textures.ts';
import { FIRE, CORE, streamX, WORLD } from './map.ts';

class Pool {
  items: { s: Sprite; life: number; max: number; vx: number; vy: number; data: number }[] = [];
  constructor(layer: Container, tex: Texture, n: number, blend: 'add' | 'normal', anchorY = 0.5) {
    for (let i = 0; i < n; i++) { const s = new Sprite(tex); s.anchor.set(0.5, anchorY); s.blendMode = blend; s.visible = false; layer.addChild(s); this.items.push({ s, life: 0, max: 1, vx: 0, vy: 0, data: 0 }); }
  }
  spawn() { return this.items.find((p) => p.life <= 0) ?? null; }
}

export class Fire {
  private flames: Sprite[] = [];
  private glow: Sprite;
  private embers: Pool;
  private smoke: Pool;
  intensity = 1;
  private acc = 0;
  private rng = new Rng(99);
  constructor(emissive: Container, fx: Container, bank: TextureBank) {
    this.glow = new Sprite(bank.lightSoft); this.glow.anchor.set(0.5); this.glow.blendMode = 'add'; this.glow.tint = 0xff9a40; this.glow.position.set(FIRE.x, FIRE.y - 12);
    emissive.addChild(this.glow);
    for (let i = 0; i < 4; i++) { const f = new Sprite(bank.flame); f.anchor.set(0.5, 1); f.position.set(FIRE.x, FIRE.y + 4); f.blendMode = 'add'; emissive.addChild(f); this.flames.push(f); }
    this.embers = new Pool(emissive, bank.dot, 14, 'add');
    this.smoke = new Pool(fx, bank.mist[0]!, 8, 'normal');
  }
  update(t: number, dt: number, smokeTint: number) {
    const k = this.intensity;
    this.glow.scale.set((1.2 + 0.4 * k) + Math.sin(t * 7) * 0.05); this.glow.alpha = 0.16 * k + Math.sin(t * 11) * 0.02;
    this.flames.forEach((f, i) => {
      const ph = i * 1.9; const n = Math.sin(t * 6 + ph) * 0.5 + Math.sin(t * 11.3 + ph * 2) * 0.3 + Math.sin(t * 1.7 + ph) * 0.2;
      f.scale.set((0.42 + 0.06 * Math.sin(t * 4 + ph)) * (0.7 + 0.3 * k), (0.38 + 0.16 * (i % 2)) * (0.45 + 0.55 * k) + n * 0.08);
      f.x = FIRE.x + Math.sin(t * 2.6 + ph) * 4 * (i % 2 ? 1 : -1) + (i - 1.5) * 5; f.rotation = Math.sin(t * 3 + ph) * 0.1; f.alpha = 0.5 + 0.35 * k + n * 0.08;
    });
    this.acc += dt * (5 * k + 1);
    while (this.acc > 1) {
      this.acc -= 1;
      const p = this.embers.spawn();
      if (p) { p.life = p.max = this.rng.range(1.2, 2.6); p.s.position.set(FIRE.x + this.rng.range(-10, 10), FIRE.y - 16); p.vx = this.rng.range(-10, 10); p.vy = -this.rng.range(28, 60); p.s.tint = this.rng.next() < 0.6 ? 0xff9a3a : 0xff6a20; p.data = this.rng.range(0, 6); }
      if (this.rng.next() < 0.5) { const s = this.smoke.spawn(); if (s) { s.life = s.max = this.rng.range(3, 5); s.s.position.set(FIRE.x + this.rng.range(-8, 8), FIRE.y - 40); s.vx = this.rng.range(-5, 5); s.vy = -this.rng.range(16, 26); s.data = this.rng.range(0, 6); } }
    }
    for (const p of this.embers.items) {
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.life -= dt; p.s.visible = true; p.s.x += (p.vx + Math.sin(t * 4 + p.data) * 14) * dt; p.s.y += p.vy * dt; p.vy -= 6 * dt;
      const u = p.life / p.max; p.s.alpha = clamp(u, 0, 1) * 0.8; p.s.scale.set(0.07 + u * 0.05);
    }
    for (const p of this.smoke.items) {
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.life -= dt; p.s.visible = true; p.s.x += (p.vx + Math.sin(t * 0.8 + p.data) * 8) * dt; p.s.y += p.vy * dt;
      const u = 1 - p.life / p.max; p.s.alpha = Math.sin(u * Math.PI) * 0.16; p.s.scale.set(0.35 + u * 0.9); p.s.tint = smokeTint;
    }
  }
}

// Fireflies: few, dim, in the dark edges only.
export class Fireflies {
  private items: { s: Sprite; x: number; y: number; ph: number; sp: number }[] = [];
  level = 0;
  constructor(emissive: Container, bank: TextureBank) {
    const rng = new Rng(5);
    for (let i = 0; i < 14; i++) {
      const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xcfe08a; s.scale.set(0.12);
      emissive.addChild(s);
      const a = rng.range(0, 6.28), r = rng.range(0.7, 1.05);
      this.items.push({ s, x: CORE.x + CORE.w / 2 + Math.cos(a) * CORE.w * 0.5 * r, y: CORE.y + CORE.h / 2 + Math.sin(a) * CORE.h * 0.5 * r, ph: rng.range(0, 6.28), sp: rng.range(0.5, 1.1) });
    }
  }
  update(t: number) {
    for (const f of this.items) {
      f.s.position.set(f.x + Math.sin(t * 0.4 * f.sp + f.ph) * 30 + Math.sin(t * 1.3 * f.sp + f.ph * 3) * 8, f.y + Math.cos(t * 0.3 * f.sp + f.ph) * 18 - 30);
      const blink = Math.max(0, Math.sin(t * 0.9 * f.sp + f.ph * 5)) ** 4;
      f.s.alpha = blink * this.level * 0.55; f.s.scale.set(0.1 + blink * 0.06); f.s.visible = f.s.alpha > 0.02;
    }
  }
}

// Moon glints on the water: sparse, cool, slow.
export class WaterGlints {
  private items: { s: Sprite; ph: number }[] = [];
  night = 0;
  constructor(emissive: Container, bank: TextureBank) {
    const rng = new Rng(11);
    for (let i = 0; i < 18; i++) {
      const y = rng.range(-60, WORLD.h + 60), x = streamX(y) + rng.range(-40, 40);
      const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.position.set(x, y); s.scale.set(0.16, 0.05); s.tint = 0xaabbd0;
      emissive.addChild(s); this.items.push({ s, ph: rng.range(0, 6.28) });
    }
  }
  update(t: number) {
    for (const g of this.items) { const k = Math.max(0, Math.sin(t * 1.1 + g.ph * 7)) ** 5; g.s.alpha = k * lerp(0.12, 0.55, this.night); g.s.visible = g.s.alpha > 0.02; }
  }
}

// Mist: a few large soft puffs drifting over the far forest and the stream, heavier at night.
export class Mist {
  private items: { s: Sprite; x: number; y: number; ph: number; base: number }[] = [];
  level = 0;
  constructor(fx: Container, bank: TextureBank, count: number) {
    const rng = new Rng(3);
    const spots = [[FIRE.x - 500, 140, 0.34], [FIRE.x + 200, 80, 0.4], [streamX(900) + 40, 900, 0.26], [FIRE.x - 650, 1300, 0.22], [FIRE.x + 420, 1250, 0.22], [streamX(300) + 80, 300, 0.3]] as const;
    for (let i = 0; i < Math.min(count, spots.length); i++) {
      const [x, y, base] = spots[i]!;
      const s = new Sprite(bank.mist[i % bank.mist.length]!); s.anchor.set(0.5); s.scale.set(rng.range(5, 7), rng.range(2, 2.8)); s.tint = 0x9fb0c0; s.alpha = 0;
      fx.addChild(s); this.items.push({ s, x, y, ph: rng.range(0, 6.28), base });
    }
  }
  update(t: number) {
    for (const m of this.items) {
      m.s.position.set(m.x + Math.sin(t * 0.07 + m.ph) * 90, m.y + Math.cos(t * 0.05 + m.ph) * 20);
      m.s.alpha = m.base * (0.55 + 0.45 * this.level) * (0.85 + Math.sin(t * 0.2 + m.ph) * 0.15);
      m.s.visible = m.s.alpha > 0.01;
    }
  }
}
