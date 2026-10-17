// Camp rendering for direction-2: painted plates (dusk + night, cross-faded), water shimmer, props and tents.
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { type TextureBank, spriteOf } from './textures.ts';
import { WORLD, FIRE, BRIDGE_Y, streamX, isWalkable, type MapLayout } from './map.ts';
import { paintPlate, PLATE } from './paint/plate.ts';
import { paintRipple } from './paint/sprites.ts';

export class World {
  readonly root = new Container();
  readonly plates = new Container();
  readonly water = new Container();
  readonly objects = new Container();
  readonly map: MapLayout;
  readonly plateScale: number;
  private plateNight: Sprite;
  private ripple: TilingSprite | null = null;
  private tentLit: Sprite[] = [];
  private bank: TextureBank;

  constructor(bank: TextureBank, map: MapLayout, low: boolean) {
    this.bank = bank; this.map = map;
    this.plateScale = low ? 0.4 : 0.75;
    this.objects.sortableChildren = true;
    this.root.addChild(this.plates, this.water, this.objects);
    const dusk = new Sprite(Texture.from(paintPlate(map, 'dusk', this.plateScale)));
    const night = new Sprite(Texture.from(paintPlate(map, 'night', this.plateScale)));
    for (const p of [dusk, night]) { p.position.set(PLATE.x, PLATE.y); p.scale.set(1 / this.plateScale); this.plates.addChild(p); }
    this.plateNight = night; night.alpha = 0;
    if (!low) this.buildShimmer();
    this.buildCamp();
  }

  walkable = (x: number, y: number): boolean => isWalkable(this.map, x, y);
  get lanternBulbs() { return this.map.lanterns.map((p) => ({ x: p.x + 10, y: p.y - 82 })); }

  // 0 = dusk plate, 1 = night plate
  setNight(n: number) { this.plateNight.alpha = n; if (this.ripple) this.ripple.alpha = 0.22 - n * 0.1; }
  setTentLit(i: number, level: number) { const s = this.tentLit[i]; if (s) s.alpha = level; }

  private buildShimmer() {
    const band: number[] = [];
    for (let y = PLATE.y; y <= PLATE.y + PLATE.h; y += 25) band.push(streamX(y) - 58, y);
    for (let y = PLATE.y + PLATE.h; y >= PLATE.y; y -= 25) band.push(streamX(y) + 58, y);
    const mask = new Graphics().poly(band).fill(0xffffff);
    this.water.addChild(mask);
    const r = new TilingSprite({ texture: Texture.from(paintRipple(128, 9)), width: 700, height: PLATE.h });
    r.position.set(1050, PLATE.y); r.tileScale.set(1.6, 1.2); r.alpha = 0.22; r.mask = mask; r.tint = 0xb8c8d8;
    this.water.addChild(r); this.ripple = r;
  }

  private buildCamp() {
    this.map.tents.forEach((t, i) => {
      const tex = this.bank.tent(t.color);
      const u = spriteOf(tex.unlit), l = spriteOf(tex.lit);
      for (const s of [u, l]) { s.position.set(t.x, t.y); s.scale.set(1.0); s.zIndex = t.y - 2; this.objects.addChild(s); }
      l.alpha = 0; l.zIndex = t.y - 1.9; this.tentLit[i] = l;
    });
    for (const seat of this.map.seats) {
      const s = spriteOf(seat.kind === 'log' ? this.bank.seatLog : this.bank.seatStump); s.position.set(seat.x, seat.y + 4); s.zIndex = seat.y + 1; this.objects.addChild(s);
    }
    const pit = spriteOf(this.bank.firepit); pit.position.set(FIRE.x, FIRE.y); pit.zIndex = FIRE.y - 24; this.objects.addChild(pit);
    for (const l of this.map.lanterns) { const s = spriteOf(this.bank.lanternPost); s.position.set(l.x, l.y); s.zIndex = l.y; this.objects.addChild(s); }
    void BRIDGE_Y; void WORLD;
  }

  update(t: number, dt: number) {
    if (this.ripple) { this.ripple.tilePosition.y += 16 * dt; this.ripple.tilePosition.x = Math.sin(t * 0.3) * 4; }
  }
}
