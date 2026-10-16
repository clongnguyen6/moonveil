// Camp rendering built from the pure MapLayout: ground, stream, props, trees. Depth-sorted by y.
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { type TextureBank, spriteOf } from './textures.ts';
import { Rng, hsl, mixColor } from './rng.ts';
import { WORLD, FIRE, CORE, BRIDGE_Y, streamX, isWalkable, type MapLayout } from './map.ts';

export class World {
  readonly root = new Container();
  readonly ground = new Container();
  readonly water = new Container();
  readonly objects = new Container();
  readonly map: MapLayout;
  private bank: TextureBank;
  private trees: { s: Sprite; phase: number }[] = [];
  private ripples: TilingSprite[] = [];

  constructor(bank: TextureBank, map: MapLayout) {
    this.bank = bank; this.map = map;
    const rng = new Rng(2026);
    this.objects.sortableChildren = true;
    this.root.addChild(this.ground, this.water, this.objects);
    this.buildGround(rng);
    this.buildStream(rng);
    this.buildCamp();
    this.buildForest();
  }

  walkable = (x: number, y: number): boolean => isWalkable(this.map, x, y);

  private buildGround(rng: Rng) {
    const g = new Graphics();
    const base = hsl(110, 30, 26), mid = hsl(105, 32, 34), lit = hsl(98, 34, 40);
    g.rect(-800, -800, WORLD.w + 1600, WORLD.h + 1600).fill(hsl(118, 28, 14));
    g.rect(0, 0, WORLD.w, WORLD.h).fill(base);
    const cx = CORE.x + CORE.w / 2, cy = CORE.y + CORE.h / 2;
    for (let i = 0; i < 5; i++) { const t = i / 4; g.ellipse(cx, cy, 1000 - t * 420, 760 - t * 330).fill({ color: mixColor(mid, lit, t), alpha: 0.5 }); }
    for (let i = 0; i < 70; i++) {
      const x = rng.range(0, WORLD.w), y = rng.range(0, WORLD.h);
      g.ellipse(x, y, rng.range(40, 140), rng.range(20, 60)).fill({ color: rng.next() > 0.5 ? lit : base, alpha: rng.range(0.1, 0.25) });
    }
    const dirt = hsl(32, 28, 42);
    for (let i = 0; i < 4; i++) { const t = i / 3; g.ellipse(FIRE.x, FIRE.y + 10, 250 - t * 110, 150 - t * 66).fill({ color: dirt, alpha: 0.22 + t * 0.2 }); }
    const path = { width: 42, color: dirt, alpha: 0.75, cap: 'round' as const, join: 'round' as const };
    g.moveTo(FIRE.x + 120, FIRE.y + 30).quadraticCurveTo(1000, 800, streamX(BRIDGE_Y) - 120, BRIDGE_Y + 6).stroke(path);
    g.moveTo(FIRE.x - 40, FIRE.y + 120).quadraticCurveTo(700, 1050, 760, WORLD.h + 40).stroke(path);
    g.moveTo(FIRE.x - 120, FIRE.y - 40).quadraticCurveTo(560, 640, 470, 560).stroke({ ...path, width: 30, alpha: 0.5 });
    this.ground.addChild(g);
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
    const band = (hw: number) => { const p: number[] = []; for (let y = -100; y <= WORLD.h + 100; y += 25) p.push(streamX(y) - hw, y); for (let y = WORLD.h + 100; y >= -100; y -= 25) p.push(streamX(y) + hw, y); return p; };
    g.poly(band(84)).fill({ color: hsl(95, 22, 24), alpha: 0.55 });
    g.poly(band(70)).fill(hsl(38, 26, 52));
    g.poly(band(60)).fill(hsl(196, 42, 40));
    g.poly(band(44)).fill({ color: hsl(200, 46, 46), alpha: 0.9 });
    for (let y = -100; y <= WORLD.h + 100; y += 25) { const cx = streamX(y); if (y === -100) g.moveTo(cx - 58, y); else g.lineTo(cx - 58, y); }
    g.stroke({ width: 3, color: 0xffffff, alpha: 0.22 });
    this.water.addChild(g);
    const mask = new Graphics().poly(band(60)).fill(0xffffff);
    this.water.addChild(mask);
    const box = { x: 1150, y: -100, w: 560, h: WORLD.h + 200 };
    for (const [scale, alpha] of [[1, 0.55], [1.7, 0.3]] as const) {
      const r = new TilingSprite({ texture: this.bank.ripple, width: box.w, height: box.h });
      r.position.set(box.x, box.y); r.tileScale.set(scale); r.alpha = alpha; r.mask = mask;
      this.water.addChild(r); this.ripples.push(r);
    }
    for (let i = 0; i < 14; i++) {
      const y = rng.range(80, WORLD.h - 80);
      if (Math.abs(y - BRIDGE_Y) < 90) continue;
      const inWater = rng.next() < 0.5;
      const x = streamX(y) + (inWater ? rng.range(-35, 35) : rng.pick([-1, 1]) * rng.range(68, 90));
      const s = spriteOf(rng.pick(this.bank.rock)); s.position.set(x, y); s.scale.set(rng.range(0.6, 1.1)); s.zIndex = y;
      this.objects.addChild(s);
    }
  }

  private buildCamp() {
    for (const t of this.map.tents) {
      const s = spriteOf(this.bank.tent(t.color)); s.position.set(t.x, t.y); s.scale.set(1.25); s.zIndex = t.y - 2;
      this.objects.addChild(s);
    }
    for (const seat of this.map.seats) {
      const s = spriteOf(seat.kind === 'log' ? this.bank.log : this.bank.stump); s.position.set(seat.x, seat.y + 4); s.scale.set(0.9); s.zIndex = seat.y + 1;
      this.objects.addChild(s);
    }
    const pit = spriteOf(this.bank.firepit); pit.position.set(FIRE.x, FIRE.y); pit.zIndex = FIRE.y - 24;
    this.objects.addChild(pit);
    const bridge = spriteOf(this.bank.bridge); bridge.position.set(streamX(BRIDGE_Y), BRIDGE_Y); bridge.zIndex = BRIDGE_Y - 40;
    this.objects.addChild(bridge);
    for (const l of this.map.lanterns) { const s = spriteOf(this.bank.lanternPost); s.position.set(l.x, l.y); s.zIndex = l.y; this.objects.addChild(s); }
    for (const b of this.map.bushes) { const s = spriteOf(this.bank.bush[b.variant] ?? this.bank.bush[0]!); s.position.set(b.x, b.y); s.scale.set(b.scale); s.zIndex = b.y; this.objects.addChild(s); }
  }

  private buildForest() {
    for (const t of this.map.trees) {
      const tex = t.kind === 'pine' ? this.bank.pine[t.variant] ?? this.bank.pine[0]! : this.bank.roundTree[t.variant] ?? this.bank.roundTree[0]!;
      const s = spriteOf(tex);
      s.position.set(t.x, t.y); s.scale.set(t.scale); s.zIndex = t.y;
      s.tint = mixColor(0xffffff, 0xdfe8ff, t.tintMix);
      this.objects.addChild(s);
      this.trees.push({ s, phase: t.phase });
    }
  }

  // lantern bulb positions (for lights), tent lantern positions
  get lanternBulbs() { return this.map.lanterns.map((p) => ({ x: p.x + 18, y: p.y - 78 })); }

  update(t: number, dt: number) {
    for (const tr of this.trees) tr.s.skew.x = Math.sin(t * 0.9 + tr.phase) * 0.018 + Math.sin(t * 2.3 + tr.phase * 2) * 0.005;
    const r0 = this.ripples[0], r1 = this.ripples[1];
    if (r0) { r0.tilePosition.y += 38 * dt; r0.tilePosition.x = Math.sin(t * 0.7) * 6; }
    if (r1) { r1.tilePosition.y += 22 * dt; r1.tilePosition.x = Math.cos(t * 0.5) * 9; }
  }
}
