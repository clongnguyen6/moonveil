// Fire, smoke, sparks, fireflies, water glints, fog. Pools of sprites, no filters.
import { Container, Sprite, type Texture } from 'pixi.js';
import { Rng, lerp, clamp } from './rng.ts';
import type { TextureBank } from './textures.ts';
import { FIRE, CORE, streamX, WORLD } from './map.ts';

class Pool {
  items: { s: Sprite; life: number; max: number; vx: number; vy: number; data: number }[] = [];
  constructor(layer: Container, tex: Texture, n: number, blend: 'add' | 'normal', anchorY = 0.5) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(tex); s.anchor.set(0.5, anchorY); s.blendMode = blend; s.visible = false;
      layer.addChild(s);
      this.items.push({ s, life: 0, max: 1, vx: 0, vy: 0, data: 0 });
    }
  }
  spawn() { return this.items.find((p) => p.life <= 0) ?? null; }
}

export class Fire {
  private flames: Sprite[] = [];
  private glow: Sprite;
  private sparks: Pool;
  private smoke: Pool;
  intensity = 1; // 1 = full campfire, ~0.35 = embers
  private acc = 0;
  private rng = new Rng(99);
  constructor(emissive: Container, fx: Container, bank: TextureBank) {
    this.glow = new Sprite(bank.dot); this.glow.anchor.set(0.5); this.glow.blendMode = 'add'; this.glow.tint = 0xff9a3a; this.glow.position.set(FIRE.x, FIRE.y - 10);
    emissive.addChild(this.glow);
    for (let i = 0; i < 6; i++) {
      const f = new Sprite(bank.flame); f.anchor.set(0.5, 1); f.position.set(FIRE.x, FIRE.y + 6); emissive.addChild(f); this.flames.push(f);
    }
    this.sparks = new Pool(emissive, bank.dot, 40, 'add');
    this.smoke = new Pool(fx, bank.smoke, 18, 'normal');
  }
  update(t: number, dt: number, smokeTint: number) {
    const k = this.intensity;
    this.glow.scale.set(4.5 * (0.8 + 0.3 * k) + Math.sin(t * 9) * 0.25 + Math.sin(t * 23) * 0.15);
    this.glow.alpha = 0.35 * k + Math.sin(t * 13) * 0.05;
    this.flames.forEach((f, i) => {
      const ph = i * 1.7;
      const n = Math.sin(t * 7 + ph) * 0.5 + Math.sin(t * 13.3 + ph * 2) * 0.3 + Math.sin(t * 2.1 + ph) * 0.2;
      const h = (0.45 + 0.25 * (i % 3)) * (0.35 + 0.65 * k);
      f.scale.set((0.55 + 0.1 * Math.sin(t * 5 + ph)) * (0.6 + 0.4 * k), h + n * 0.12);
      f.x = FIRE.x + Math.sin(t * 3 + ph) * 6 * (i % 2 ? 1 : -1) + (i - 2.5) * 5;
      f.rotation = Math.sin(t * 4 + ph) * 0.12;
      f.alpha = 0.55 + 0.4 * k + n * 0.1;
    });
    this.acc += dt * (14 * k + 2);
    while (this.acc > 1) {
      this.acc -= 1;
      const p = this.sparks.spawn();
      if (p) { p.life = p.max = this.rng.range(0.6, 1.6); p.s.position.set(FIRE.x + this.rng.range(-14, 14), FIRE.y - 20); p.vx = this.rng.range(-25, 25); p.vy = -this.rng.range(60, 140); p.s.tint = this.rng.next() < 0.5 ? 0xffb050 : 0xff7a30; p.data = this.rng.range(0, 6); }
      if (this.rng.next() < 0.35) {
        const s = this.smoke.spawn();
        if (s) { s.life = s.max = this.rng.range(2.5, 4); s.s.position.set(FIRE.x + this.rng.range(-10, 10), FIRE.y - 40); s.vx = this.rng.range(-8, 8); s.vy = -this.rng.range(28, 44); s.data = this.rng.range(0, 6); }
      }
    }
    for (const p of this.sparks.items) {
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.life -= dt; p.s.visible = true;
      p.s.x += (p.vx + Math.sin(t * 6 + p.data) * 30) * dt; p.s.y += p.vy * dt; p.vy -= 20 * dt;
      const u = p.life / p.max; p.s.alpha = clamp(u * 1.5, 0, 1); p.s.scale.set(0.12 + u * 0.1);
    }
    for (const p of this.smoke.items) {
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.life -= dt; p.s.visible = true;
      p.s.x += (p.vx + Math.sin(t * 1.2 + p.data) * 12) * dt; p.s.y += p.vy * dt;
      const u = 1 - p.life / p.max; p.s.alpha = Math.sin(u * Math.PI) * 0.35 * (0.5 + 0.5 * k); p.s.scale.set(0.6 + u * 1.6); p.s.tint = smokeTint;
    }
  }
}

export class Fireflies {
  private items: { s: Sprite; x: number; y: number; ph: number; sp: number }[] = [];
  level = 0; // 0 day .. 1 night
  constructor(emissive: Container, bank: TextureBank) {
    const rng = new Rng(5);
    for (let i = 0; i < 36; i++) {
      const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xd6ff6a; s.scale.set(0.22);
      emissive.addChild(s);
      this.items.push({ s, x: rng.range(CORE.x - 100, CORE.x + CORE.w + 100), y: rng.range(CORE.y - 60, CORE.y + CORE.h + 80), ph: rng.range(0, 6.28), sp: rng.range(0.6, 1.4) });
    }
  }
  update(t: number) {
    for (const f of this.items) {
      const x = f.x + Math.sin(t * 0.5 * f.sp + f.ph) * 40 + Math.sin(t * 1.7 * f.sp + f.ph * 3) * 12;
      const y = f.y + Math.cos(t * 0.4 * f.sp + f.ph) * 26 + Math.sin(t * 2.3 * f.sp + f.ph) * 8 - 30;
      f.s.position.set(x, y);
      const blink = Math.max(0, Math.sin(t * 1.3 * f.sp + f.ph * 5)) ** 3;
      f.s.alpha = blink * this.level * 0.95;
      f.s.scale.set(0.18 + blink * 0.12);
      f.s.visible = f.s.alpha > 0.02;
    }
  }
}

export class WaterGlints {
  private items: { s: Sprite; ph: number }[] = [];
  night = 0;
  constructor(emissive: Container, bank: TextureBank) {
    const rng = new Rng(11);
    for (let i = 0; i < 40; i++) {
      const y = rng.range(-60, WORLD.h + 60), x = streamX(y) + rng.range(-46, 46);
      const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.position.set(x, y); s.scale.set(0.15, 0.08);
      emissive.addChild(s); this.items.push({ s, ph: rng.range(0, 6.28) });
    }
  }
  update(t: number) {
    const n = this.night;
    for (const g of this.items) {
      const k = Math.max(0, Math.sin(t * 2.2 + g.ph * 7)) ** 4;
      g.s.alpha = k * lerp(0.35, 0.8, n);
      g.s.tint = n > 0.5 ? 0xbfd2ff : 0xffffff;
      g.s.visible = g.s.alpha > 0.02;
    }
  }
}

export class Fog {
  private items: { s: Sprite; x: number; y: number; ph: number }[] = [];
  level = 0;
  constructor(fx: Container, bank: TextureBank) {
    const rng = new Rng(3);
    for (let i = 0; i < 7; i++) {
      const s = new Sprite(bank.fog); s.anchor.set(0.5); s.tint = 0xb0b0ff; s.scale.set(rng.range(2.4, 3.6), rng.range(1.2, 1.8));
      fx.addChild(s); this.items.push({ s, x: rng.range(CORE.x - 150, CORE.x + CORE.w + 150), y: rng.range(CORE.y, CORE.y + CORE.h + 100), ph: rng.range(0, 6.28) });
    }
  }
  update(t: number) {
    for (const f of this.items) {
      f.s.position.set(f.x + Math.sin(t * 0.12 + f.ph) * 120, f.y + Math.cos(t * 0.09 + f.ph) * 30);
      f.s.alpha = this.level * (0.5 + Math.sin(t * 0.3 + f.ph) * 0.2);
      f.s.visible = f.s.alpha > 0.01;
    }
  }
}
