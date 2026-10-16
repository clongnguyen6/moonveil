// Camp map: static layout, ground, stream, props, trees. Fixed camera, 2.5D (depth-sorted by y).
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { TextureBank, spriteOf } from './textures';
import { Rng, hsl, mixColor } from './rng';

export const WORLD = { w: 1700, h: 1400 };
export const FIRE = { x: 800, y: 760 };
// The camera frames this rectangle on every screen; what lies outside is forest and stream margin.
export const CORE = { x: 280, y: 240, w: 1140, h: 820 };
export const BRIDGE_Y = 760;

export function streamX(y: number): number {
  return 1380 - 0.09 * (y - 760) + 50 * Math.sin(y / 220);
}

export interface Tent { x: number; y: number; color: number; door: { x: number; y: number }; lanternAt: { x: number; y: number } }
export interface Seat { x: number; y: number; sit: { x: number; y: number } }

export const TENT_COLORS = [0xb5543c, 0x6b8e5a, 0x4a7f8c, 0xc9a04b, 0x7a5c8e, 0xc0704f, 0x5c7fa8, 0x8f9a5a, 0xa85c6e, 0x6f6f8c, 0x9c6b3a, 0x5a8a7a];

export class World {
  readonly root = new Container();
  readonly ground = new Container();
  readonly water = new Container();
  readonly objects = new Container();
  readonly tents: Tent[] = [];
  readonly seats: Seat[] = [];
  readonly lanterns: { x: number; y: number }[] = [];
  private trees: { s: Sprite; phase: number }[] = [];
  private ripples: TilingSprite[] = [];
  private blockers: { x: number; y: number; rx: number; ry: number }[] = [];
  readonly streamPoly: number[] = [];

  constructor(readonly bank: TextureBank, readonly playerCount: number) {
    const rng = new Rng(2026);
    this.objects.sortableChildren = true;
    this.root.addChild(this.ground, this.water, this.objects);
    this.buildGround(rng);
    this.buildStream(rng);
    this.buildCamp(rng);
    this.buildForest(rng);
  }

  private buildGround(rng: Rng) {
    const g = new Graphics();
    const base = hsl(110, 30, 26), mid = hsl(105, 32, 34), lit = hsl(98, 34, 40);
    g.rect(-800, -800, WORLD.w + 1600, WORLD.h + 1600).fill(hsl(118, 28, 14));
    g.rect(0, 0, WORLD.w, WORLD.h).fill(base);
    const cx = CORE.x + CORE.w / 2, cy = CORE.y + CORE.h / 2;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      g.ellipse(cx, cy, 1000 - t * 420, 760 - t * 330).fill({ color: mixColor(mid, lit, t), alpha: 0.5 });
    }
    // soft grass patches
    for (let i = 0; i < 70; i++) {
      const x = rng.range(0, WORLD.w), y = rng.range(0, WORLD.h);
      g.ellipse(x, y, rng.range(40, 140), rng.range(20, 60)).fill({ color: rng.next() > 0.5 ? lit : base, alpha: rng.range(0.1, 0.25) });
    }
    // dirt clearing around the fire
    const dirt = hsl(32, 28, 42);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      g.ellipse(FIRE.x, FIRE.y + 10, 250 - t * 110, 150 - t * 66).fill({ color: dirt, alpha: 0.22 + t * 0.2 });
    }
    // paths
    const path = { width: 42, color: dirt, alpha: 0.75, cap: 'round' as const, join: 'round' as const };
    g.moveTo(FIRE.x + 120, FIRE.y + 30).quadraticCurveTo(1000, 800, streamX(BRIDGE_Y) - 120, BRIDGE_Y + 6).stroke(path);
    g.moveTo(FIRE.x - 40, FIRE.y + 120).quadraticCurveTo(700, 1050, 760, WORLD.h + 40).stroke(path);
    g.moveTo(FIRE.x - 120, FIRE.y - 40).quadraticCurveTo(560, 640, 470, 560).stroke({ ...path, width: 30, alpha: 0.5 });
    this.ground.addChild(g);

    // tufts and flowers (sprites: cheap, batched)
    const deco = new Container();
    for (let i = 0; i < 220; i++) {
      const x = rng.range(60, WORLD.w - 60), y = rng.range(120, WORLD.h - 40);
      if (Math.abs(x - streamX(y)) < 95) continue;
      if (Math.hypot((x - FIRE.x) / 200, (y - FIRE.y) / 120) < 1) continue;
      const s = spriteOf(rng.next() < 0.82 ? this.bank.tuft : this.bank.flower);
      s.position.set(x, y); s.scale.set(rng.range(0.8, 1.3)); s.alpha = 0.9;
      deco.addChild(s);
    }
    this.ground.addChild(deco);
  }

  private buildStream(rng: Rng) {
    const g = new Graphics();
    const left: number[] = [], right: number[] = [];
    for (let y = -100; y <= WORLD.h + 100; y += 25) { const cx = streamX(y); left.push(cx - 60, y); right.push(cx + 60, y); }
    const band = (hw: number) => { const p: number[] = []; for (let y = -100; y <= WORLD.h + 100; y += 25) p.push(streamX(y) - hw, y); for (let y = WORLD.h + 100; y >= -100; y -= 25) p.push(streamX(y) + hw, y); return p; };
    g.poly(band(84)).fill({ color: hsl(95, 22, 24), alpha: 0.55 });   // damp bank
    g.poly(band(70)).fill(hsl(38, 26, 52));                            // sand/pebbles
    g.poly(band(60)).fill(hsl(196, 42, 40));                           // water
    g.poly(band(44)).fill({ color: hsl(200, 46, 46), alpha: 0.9 });    // deeper middle
    this.streamPoly.push(...band(60));
    // bank highlight on the left (lit) edge
    for (let y = -100; y <= WORLD.h + 100; y += 25) { const cx = streamX(y); if (y === -100) g.moveTo(cx - 58, y); else g.lineTo(cx - 58, y); }
    g.stroke({ width: 3, color: 0xffffff, alpha: 0.22 });
    this.water.addChild(g);

    const mask = new Graphics().poly(band(60)).fill(0xffffff);
    this.water.addChild(mask);
    const box = { x: 1100, y: -100, w: 500, h: WORLD.h + 200 };
    for (const [scale, alpha] of [[1, 0.55], [1.7, 0.3]] as const) {
      const r = new TilingSprite({ texture: this.bank.ripple, width: box.w, height: box.h });
      r.position.set(box.x, box.y); r.tileScale.set(scale); r.alpha = alpha; r.mask = mask;
      this.water.addChild(r); this.ripples.push(r);
    }
    // rocks in and around the stream
    for (let i = 0; i < 14; i++) {
      const y = rng.range(80, WORLD.h - 80);
      if (Math.abs(y - BRIDGE_Y) < 90) continue;
      const inWater = rng.next() < 0.5;
      const x = streamX(y) + (inWater ? rng.range(-35, 35) : rng.pick([-1, 1]) * rng.range(68, 90));
      const s = spriteOf(rng.pick(this.bank.rock)); s.position.set(x, y); s.scale.set(rng.range(0.6, 1.1)); s.zIndex = y;
      this.objects.addChild(s);
    }
  }

  private buildCamp(rng: Rng) {
    const n = this.playerCount;
    // tents on the upper arc around the fire
    for (let i = 0; i < n; i++) {
      // two staggered rows so larger tents do not overlap
      const a = ((198 + (144 * i) / (n - 1)) * Math.PI) / 180;
      const row = i % 2;
      const x = FIRE.x + Math.cos(a) * (row ? 560 : 430), y = FIRE.y + Math.sin(a) * (row ? 380 : 290);
      const color = TENT_COLORS[i % TENT_COLORS.length];
      const s = spriteOf(this.bank.tent(color)); s.position.set(x, y); s.scale.set(1.25); s.zIndex = y - 2;
      this.objects.addChild(s);
      this.tents.push({ x, y, color, door: { x, y: y + 8 }, lanternAt: { x: x + 30, y: y - 40 } });
      this.blockers.push({ x, y: y - 30, rx: 60, ry: 34 });
    }
    // seats around the fire
    for (let i = 0; i < n; i++) {
      const a = ((-90 + (360 * i) / n + 18) * Math.PI) / 180;
      const x = FIRE.x + Math.cos(a) * 165, y = FIRE.y + Math.sin(a) * 98;
      const s = spriteOf(i % 3 === 1 ? this.bank.log : this.bank.stump); s.position.set(x, y + 4); s.scale.set(0.9); s.zIndex = y + 1;
      this.objects.addChild(s);
      this.seats.push({ x, y, sit: { x, y: y - 10 } });
    }
    const pit = spriteOf(this.bank.firepit); pit.position.set(FIRE.x, FIRE.y); pit.zIndex = FIRE.y - 24;
    this.objects.addChild(pit);
    this.blockers.push({ x: FIRE.x, y: FIRE.y, rx: 62, ry: 38 });

    const bridge = spriteOf(this.bank.bridge); bridge.position.set(streamX(BRIDGE_Y), BRIDGE_Y); bridge.zIndex = BRIDGE_Y - 40;
    this.objects.addChild(bridge);

    for (const [x, y] of [[streamX(BRIDGE_Y) - 150, BRIDGE_Y + 40], [FIRE.x - 330, FIRE.y + 180], [FIRE.x + 300, FIRE.y - 290]] as const) {
      const s = spriteOf(this.bank.lanternPost); s.position.set(x, y); s.zIndex = y;
      this.objects.addChild(s); this.lanterns.push({ x: x + 18, y: y - 78 }); this.blockers.push({ x, y, rx: 8, ry: 5 });
    }
    // bushes and extra rocks near the camp edge
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(1, 1.25);
      const x = CORE.x + CORE.w / 2 + Math.cos(a) * CORE.w * 0.5 * r, y = CORE.y + CORE.h / 2 + Math.sin(a) * CORE.h * 0.5 * r;
      if (Math.abs(x - streamX(y)) < 100) continue;
      const s = spriteOf(rng.pick(this.bank.bush)); s.position.set(x, y); s.scale.set(rng.range(0.8, 1.2)); s.zIndex = y;
      this.objects.addChild(s); this.blockers.push({ x, y: y - 10, rx: 28, ry: 14 });
    }
  }

  private buildForest(rng: Rng) {
    const placed: { x: number; y: number }[] = [];
    let tries = 0;
    while (placed.length < 300 && tries++ < 9000) {
      const x = rng.range(-400, WORLD.w + 400), y = rng.range(-560, WORLD.h + 640);
      const inCore = x > CORE.x - 20 && x < CORE.x + CORE.w + 20 && y > CORE.y - 20 && y < CORE.y + CORE.h + 30;
      if (inCore && rng.next() > 0.08) continue;
      if (Math.hypot((x - FIRE.x) / 660, (y - FIRE.y) / 470) < 1) continue;
      if (this.tents.some((t) => Math.hypot(t.x - x, (t.y - y) * 1.4) < 120)) continue;
      if (Math.abs(x - streamX(y)) < 110 || Math.abs(y - BRIDGE_Y) < 70 && x > streamX(y) - 200) continue;
      if (Math.abs(x - 760) < 60 && y > 1150) continue; // bottom path
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 62)) continue;
      placed.push({ x, y });
      const pine = rng.next() < 0.7;
      const s = spriteOf(pine ? rng.pick(this.bank.pine) : rng.pick(this.bank.roundTree));
      const sc = rng.range(0.85, 1.3) * (inCore ? 0.9 : 1);
      s.position.set(x, y); s.scale.set(sc); s.zIndex = y;
      s.tint = mixColor(0xffffff, 0xdfe8ff, rng.range(0, 0.25));
      this.objects.addChild(s);
      this.trees.push({ s, phase: rng.range(0, 6.28) });
      this.blockers.push({ x, y, rx: 20 * sc, ry: 10 * sc });
    }
  }

  walkable = (x: number, y: number): boolean => {
    if (x < 40 || x > WORLD.w - 40 || y < 120 || y > WORLD.h - 30) return false;
    const inStream = Math.abs(x - streamX(y)) < 68;
    if (inStream && Math.abs(y - BRIDGE_Y) > 30) return false;
    for (const b of this.blockers) if (((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 < 1) return false;
    return true;
  };

  // random point to wander to inside the camp core
  wanderPoint(rng: Rng, avoid: { x: number; y: number }[] = []): { x: number; y: number } {
    for (let i = 0; i < 60; i++) {
      const x = rng.range(CORE.x + 40, CORE.x + CORE.w - 40), y = rng.range(CORE.y + 140, CORE.y + CORE.h + 120);
      if (x > streamX(y) - 95) continue;
      if (!this.walkable(x, y)) continue;
      if (avoid.some((p) => Math.hypot(p.x - x, p.y - y) < 110)) continue;
      return { x, y };
    }
    return { x: FIRE.x, y: FIRE.y + 200 };
  }

  update(t: number, dt: number) {
    for (const tr of this.trees) tr.s.skew.x = Math.sin(t * 0.9 + tr.phase) * 0.018 + Math.sin(t * 2.3 + tr.phase * 2) * 0.005;
    this.ripples[0].tilePosition.y += 38 * dt; this.ripples[0].tilePosition.x = Math.sin(t * 0.7) * 6;
    this.ripples[1].tilePosition.y += 22 * dt; this.ripples[1].tilePosition.x = Math.cos(t * 0.5) * 9;
  }
}
