// Procedural camper avatars. Appearance is cosmetic only and never derived from role.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { type TextureBank, type Baked, spriteOf } from './textures.ts';
import { shade, lerp, clamp, hashString } from './rng.ts';
import type { SceneAppearance } from './types.ts';
import { HAIR_COLOR_VALUES, SKIN_COLORS, TOP_COLORS } from './appearance.ts';

const PANTS = [0x3a4457, 0x4f3f33, 0x2f3a3f, 0x5a5460] as const;
const HAT_TINTS = [0xe9e0c8, 0x9bc1d9, 0xd8c9a0, 0xd9603b, 0x3f8f7a, 0xf0d7a0] as const;
const O = (c: number) => ({ width: 2, color: shade(c, 0.55), alpha: 0.6, join: 'round' as const, cap: 'round' as const });

// Draws a camper facing right, feet at (0,0). ghost=true draws the spectral variant (no legs, tail, pale).
export function drawAvatar(a: SceneAppearance, ghost: boolean, seedKey: string): Graphics {
  const g = new Graphics();
  const h = hashString(seedKey);
  const skin = ghost ? 0xdbe8ff : SKIN_COLORS[a.skin];
  const top = ghost ? 0xc3d4f5 : TOP_COLORS[a.top];
  const pants = ghost ? 0xb4c6ec : PANTS[h % PANTS.length]!;
  const hairC = ghost ? 0xa7b8dd : HAIR_COLOR_VALUES[a.hairColor];
  const hatC = ghost ? 0xb9c8ea : a.hat === 'hood' ? TOP_COLORS[a.top] : HAT_TINTS[(h >>> 4) % HAT_TINTS.length]!;
  const extraC = ghost ? 0xd0dcf5 : a.extra === 'scarf' ? HAT_TINTS[(h >>> 8) % HAT_TINTS.length]! : 0x6b4f3a;

  if (a.extra === 'backpack') g.roundRect(-24, -44, 16, 26, 6).fill(extraC).stroke(O(extraC));
  if (a.hat === 'hood') g.circle(0, -58, 20).fill(hatC).stroke(O(hatC));
  else if (a.hair === 'long') g.roundRect(-16, -72, 32, 42, 12).fill(hairC).stroke(O(hairC));
  if (!ghost) {
    g.roundRect(-10, -16, 9, 16, 3).fill(pants).stroke(O(pants));
    g.roundRect(1, -16, 9, 16, 3).fill(pants).stroke(O(pants));
    g.roundRect(-11, -3, 11, 4, 2).fill(0x2a2a30);
    g.roundRect(0, -3, 11, 4, 2).fill(0x2a2a30);
  } else {
    g.moveTo(-16, -22).quadraticCurveTo(-18, -6, -10, 0).quadraticCurveTo(-4, -8, 0, -2)
      .quadraticCurveTo(6, -10, 12, 2).quadraticCurveTo(18, -6, 16, -22).closePath().fill(top).stroke(O(top));
  }
  g.roundRect(-16, -48, 32, ghost ? 28 : 34, 10).fill(top).stroke(O(top));
  g.roundRect(-13, -46, 12, 10, 5).fill({ color: 0xffffff, alpha: 0.14 });
  g.roundRect(-21, -44, 8, 22, 4).fill(top).stroke(O(top));
  g.roundRect(13, -44, 8, 22, 4).fill(top).stroke(O(top));
  g.circle(-17, -22, 4).fill(skin);
  g.circle(17, -22, 4).fill(skin);
  if (a.extra === 'scarf') { g.roundRect(-14, -50, 28, 9, 4).fill(extraC).stroke(O(extraC)); g.roundRect(6, -48, 8, 16, 3).fill(extraC); }
  g.circle(0, -60, 15).fill(skin).stroke(O(skin));
  if (a.hair !== 'bald' && a.hat !== 'hood') {
    if (a.hair === 'curly') { g.circle(-9, -70, 8).fill(hairC); g.circle(2, -74, 8).fill(hairC); g.circle(11, -68, 7).fill(hairC); g.circle(-13, -60, 6).fill(hairC); }
    else g.moveTo(-15, -62).quadraticCurveTo(-14, -78, 0, -77).quadraticCurveTo(14, -78, 15, -64).quadraticCurveTo(8, -70, 2, -72).quadraticCurveTo(-6, -71, -15, -62).fill(hairC);
    if (a.hair === 'bun') g.circle(-6, -78, 6).fill(hairC).stroke(O(hairC));
  }
  g.circle(5, -60, 2).fill(0x2a2229);
  g.circle(11, -59, 2).fill(0x2a2229);
  g.ellipse(9, -54, 4, 2).fill({ color: 0xff8a8a, alpha: ghost ? 0.15 : 0.35 });
  if (a.hat === 'beanie') {
    g.moveTo(-15, -64).quadraticCurveTo(-13, -84, 0, -84).quadraticCurveTo(14, -84, 15, -64).closePath().fill(hatC).stroke(O(hatC));
    g.roundRect(-16, -68, 32, 7, 3).fill(shade(hatC, 0.85));
    g.circle(0, -85, 4).fill(shade(hatC, 1.15));
  } else if (a.hat === 'cap') {
    g.moveTo(-15, -66).quadraticCurveTo(-12, -82, 0, -82).quadraticCurveTo(13, -82, 15, -66).closePath().fill(hatC).stroke(O(hatC));
    g.roundRect(4, -69, 20, 5, 2).fill(shade(hatC, 0.9)).stroke(O(hatC));
  } else if (a.hat === 'bucket') {
    g.poly([-13, -84, 13, -84, 15, -68, -15, -68]).fill(hatC).stroke(O(hatC));
    g.ellipse(0, -67, 22, 5).fill(shade(hatC, 0.9)).stroke(O(hatC));
  } else if (a.hat === 'flower') {
    for (let i = 0; i < 5; i++) { const an = (i / 5) * Math.PI * 2; g.circle(-9 + Math.cos(an) * 4.5, -77 + Math.sin(an) * 4.5, 3).fill(ghost ? 0xe6eeff : 0xf2e6c8); }
    g.circle(-9, -77, 2.2).fill(ghost ? 0xc8d6ff : 0xf0c060);
  }
  return g;
}

export type AvatarMode = 'walk' | 'idle' | 'seated' | 'ghost' | 'hidden';

export class Avatar {
  readonly root = new Container();
  readonly shadow: Sprite;
  readonly body: Sprite;
  readonly ring: Sprite;
  readonly arcs: Sprite;
  readonly label: Text;
  readonly emote: Text;
  readonly glow: Sprite;          // emissive-layer aura (ghosts)
  readonly wisps: Sprite[] = [];  // emissive-layer trail (ghosts)
  readonly seat: string;
  private bodyTex: Baked;
  private ghostTex: Baked;
  private trail: { x: number; y: number }[] = [];
  x = 0; y = 0;
  facing: 1 | -1 = 1;
  mode: AvatarMode = 'idle';
  speaking = false;
  speed = 190;
  alpha = 1;
  private t: number;
  private moving = 0;
  private speakT = 0;
  private emoteT = 0;
  private steerSide = 1;
  target: { x: number; y: number } | null = null;
  onArrive: (() => void) | null = null;
  labelBaseY = 0;   // label anchor (world units, relative to the feet) before layout offsets

  constructor(seat: string, name: string, appearance: SceneAppearance, bank: TextureBank) {
    this.seat = seat;
    this.t = (hashString(seat) % 1000) / 137;
    this.bodyTex = bank.bake(drawAvatar(appearance, false, seat), 0, 0, 3);
    this.ghostTex = bank.bake(drawAvatar(appearance, true, seat), 0, 0, 3);
    this.shadow = new Sprite(bank.shadow); this.shadow.anchor.set(0.5); this.shadow.scale.set(1.1, 0.5);
    this.ring = spriteOf(bank.ring); this.ring.anchor.set(0.5); this.ring.visible = false; this.ring.tint = 0xffe28a;
    this.body = spriteOf(this.bodyTex);
    this.arcs = spriteOf(bank.speakArcs); this.arcs.anchor.set(0.1, 0.5); this.arcs.visible = false; this.arcs.tint = 0xffe28a;
    this.label = new Text({ text: name, style: { fontFamily: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: 0xfff6e6, stroke: { color: 0x1a1410, width: 3 }, align: 'center' } });
    this.label.anchor.set(0.5, 1); this.label.resolution = 2;
    this.emote = new Text({ text: '', style: { fontSize: 22 } }); this.emote.anchor.set(0.5, 1); this.emote.visible = false; this.emote.resolution = 2;
    this.glow = new Sprite(bank.lightSoft); this.glow.anchor.set(0.5); this.glow.blendMode = 'add'; this.glow.tint = 0x9fc0ff; this.glow.alpha = 0; this.glow.scale.set(0.5);
    for (let i = 0; i < 4; i++) { const w = new Sprite(bank.dot); w.anchor.set(0.5); w.blendMode = 'add'; w.tint = 0xbfd8ff; w.alpha = 0; w.scale.set(0.3 - i * 0.05); this.wisps.push(w); }
    this.root.addChild(this.shadow, this.ring, this.body, this.arcs, this.label, this.emote);
  }

  setName(name: string) { if (this.label.text !== name) this.label.text = name; }
  setPos(x: number, y: number) { this.x = x; this.y = y; }
  walkTo(x: number, y: number, onArrive?: () => void) { this.target = { x, y }; this.onArrive = onArrive ?? null; }
  showEmote(s: string) { this.emote.text = s; this.emote.visible = true; this.emoteT = 2.2; }
  get isGhost() { return this.mode === 'ghost'; }

  // called by the scene after update(): screen-space layout result in world units
  setLabelOffset(dx: number, dy: number) { this.label.x = dx; this.label.y = this.labelBaseY + dy; }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy(); for (const w of this.wisps) w.destroy();
    this.bodyTex.texture.destroy(true); this.ghostTex.texture.destroy(true);
  }

  // dir: optional input vector (local player). walkable: collision test for living movement.
  update(dt: number, labelScale: number, dir?: { x: number; y: number }, walkable?: (x: number, y: number) => boolean) {
    this.t += dt;
    const ghost = this.mode === 'ghost';
    let vx = 0, vy = 0;
    if (dir && (dir.x || dir.y)) {
      vx = dir.x * this.speed; vy = dir.y * this.speed * 0.85;
      this.target = null;
    } else if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) { this.x = this.target.x; this.y = this.target.y; this.target = null; const cb = this.onArrive; this.onArrive = null; cb?.(); }
      else { const sp = Math.min(this.speed, d / dt); vx = (dx / d) * sp; vy = (dy / d) * sp; }
    }
    const movingNow = vx !== 0 || vy !== 0 ? 1 : 0;
    this.moving = lerp(this.moving, movingNow, clamp(dt * 10, 0, 1));
    if (movingNow) {
      const nx = this.x + vx * dt, ny = this.y + vy * dt;
      if (ghost || !walkable || walkable(nx, ny)) { this.x = nx; this.y = ny; }
      else {
        const sp = Math.hypot(vx, vy), a0 = Math.atan2(vy, vx);
        let moved = false;
        for (const da of [0.5, 1.0, 1.5, 2.0]) {
          for (const sgn of [this.steerSide, -this.steerSide]) {
            const a = a0 + da * sgn, tx = this.x + Math.cos(a) * sp * dt, ty = this.y + Math.sin(a) * sp * dt;
            if (walkable(tx, ty)) { this.x = tx; this.y = ty; this.steerSide = sgn; moved = true; break; }
          }
          if (moved) break;
        }
        if (!moved && this.target) { this.target = null; this.onArrive?.(); this.onArrive = null; }
      }
      if (Math.abs(vx) > 1) this.facing = vx > 0 ? 1 : -1;
      if (this.mode === 'idle' || this.mode === 'walk') this.mode = 'walk';
    } else if (this.mode === 'walk') this.mode = 'idle';
    this.pose(dt, labelScale);
  }

  // pose from an interpolated server pose (remote players)
  applyPose(x: number, y: number, facing: 1 | -1, moving: boolean, dt: number, labelScale: number) {
    this.x = x; this.y = y; this.facing = facing; this.target = null;
    this.t += dt;
    this.moving = lerp(this.moving, moving ? 1 : 0, clamp(dt * 10, 0, 1));
    if (this.mode === 'idle' || this.mode === 'walk') this.mode = moving ? 'walk' : 'idle';
    this.pose(dt, labelScale);
  }

  private pose(dt: number, labelScale: number) {
    const ghost = this.mode === 'ghost';
    const seated = this.mode === 'seated';
    const bob = ghost ? Math.sin(this.t * 2.2) * 5 : this.moving * Math.abs(Math.sin(this.t * 11)) * 5;
    const breathe = 1 + Math.sin(this.t * 1.6) * 0.015;
    const squash = 1 + this.moving * Math.sin(this.t * 11) * 0.06;
    const tex = ghost ? this.ghostTex : this.bodyTex;
    this.body.texture = tex.texture;
    this.body.anchor.set(tex.ax, tex.ay);
    const S = 0.8;
    this.body.scale.set(this.facing * S * (1 / squash) * (seated ? 1.06 : 1), S * squash * breathe * (seated ? 0.86 : 1));
    this.body.y = (ghost ? -14 : 0) - bob + (seated ? 2 : 0);
    this.body.rotation = ghost ? Math.sin(this.t * 1.3) * 0.05 : this.moving * Math.sin(this.t * 11) * 0.04;
    this.body.alpha = ghost ? 0.78 : 1;
    this.shadow.alpha = ghost ? 0.25 : 0.9;
    this.shadow.scale.set(ghost ? 0.9 : 1.1, ghost ? 0.35 : 0.5);
    this.glow.alpha = ghost ? 0.22 + Math.sin(this.t * 2.2) * 0.05 : 0;
    this.glow.position.set(this.x, this.y - 26);
    if (ghost) {
      this.trail.unshift({ x: this.x, y: this.y - 24 - bob });
      if (this.trail.length > 24) this.trail.pop();
      this.wisps.forEach((w, i) => { const p = this.trail[Math.min(this.trail.length - 1, (i + 1) * 5)] ?? { x: this.x, y: this.y }; w.position.set(p.x + Math.sin(this.t * 4 + i) * 4, p.y + Math.cos(this.t * 3 + i) * 3); w.alpha = this.moving * (0.5 - i * 0.1) + 0.08; });
    } else for (const w of this.wisps) w.alpha = 0;

    this.speakT = lerp(this.speakT, this.speaking ? 1 : 0, clamp(dt * 8, 0, 1));
    this.ring.visible = this.speakT > 0.02;
    this.ring.alpha = this.speakT * (0.75 + Math.sin(this.t * 7) * 0.25);
    this.ring.scale.set((1 + Math.sin(this.t * 7) * 0.08) * this.speakT);
    this.arcs.visible = this.speakT > 0.02;
    this.arcs.alpha = this.speakT * (0.8 + Math.sin(this.t * 9) * 0.2);
    this.arcs.position.set(this.facing * 17, this.body.y - 50 - (ghost ? 12 : 0));
    this.arcs.scale.set(this.facing * (0.9 + Math.sin(this.t * 9) * 0.1) * this.speakT, (0.9 + Math.sin(this.t * 9) * 0.1) * this.speakT);
    this.label.scale.set(labelScale);
    this.labelBaseY = this.body.y - 78 - (ghost ? 12 : 0);
    this.label.y = this.labelBaseY;
    this.label.style.fill = this.speaking ? 0xffe28a : ghost ? 0xcfe0ff : 0xfff6e6;
    this.label.alpha = ghost ? 0.85 : 1;
    if (this.emoteT > 0) { this.emoteT -= dt; this.emote.y = this.label.y - 18 * labelScale - Math.sin((2.2 - this.emoteT) * 3) * 3; this.emote.scale.set(labelScale); this.emote.alpha = clamp(this.emoteT * 2, 0, 1); if (this.emoteT <= 0) this.emote.visible = false; }

    this.root.position.set(this.x, this.y);
    this.root.zIndex = ghost ? this.y + 400 : this.y;
    this.root.visible = this.mode !== 'hidden' && this.alpha > 0.01;
    this.root.alpha = this.alpha;
    this.glow.visible = this.root.visible && ghost;
    for (const w of this.wisps) w.visible = this.glow.visible;
  }
}
