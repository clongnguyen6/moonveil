// Avatar display object on the painted pose textures. Appearance is cosmetic only and never derived from role.
import { Container, Sprite, Text } from 'pixi.js';
import { type TextureBank, type Baked, spriteOf } from './textures.ts';
import { lerp, clamp, hashString } from './rng.ts';
import type { SceneAppearance } from './types.ts';

export type AvatarMode = 'walk' | 'idle' | 'seated' | 'ghost' | 'hidden';
const SCALE = 1.0;   // painted at 128 units standing → ~118 world units (tents ~110): adult proportions in the 2.5D view

export class Avatar {
  readonly root = new Container();
  readonly shadow: Sprite;
  readonly body: Sprite;
  readonly ring: Sprite;
  readonly bars: Sprite;
  readonly label: Text;
  readonly emote: Text;
  readonly glow: Sprite;          // emissive-layer aura (ghosts), very faint
  readonly wisps: Sprite[] = [];  // kept for API compatibility; unused in this direction
  readonly seat: string;
  private bank: TextureBank;
  private app: SceneAppearance;
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
  private walkPhase = 0;
  target: { x: number; y: number } | null = null;
  onArrive: (() => void) | null = null;

  constructor(seat: string, name: string, appearance: SceneAppearance, bank: TextureBank) {
    this.seat = seat; this.bank = bank; this.app = appearance;
    this.t = (hashString(seat) % 1000) / 137;
    this.shadow = new Sprite(bank.shadow); this.shadow.anchor.set(0.5); this.shadow.scale.set(1.0, 0.42); this.shadow.alpha = 0.7;
    this.ring = spriteOf(bank.ring); this.ring.visible = false; this.ring.tint = 0xe0a458;
    this.body = spriteOf(this.tex('stand', false));
    this.bars = spriteOf(bank.speakBars); this.bars.visible = false; this.bars.tint = 0xe0a458;
    this.label = new Text({ text: name, style: { fontFamily: 'Inter, "SF Pro Text", "Segoe UI", system-ui, sans-serif', fontSize: 12, fontWeight: '500', fill: 0xe8e4dc, dropShadow: { color: 0x000000, alpha: 0.7, blur: 3, distance: 1, angle: Math.PI / 2 }, align: 'center' } });
    this.label.anchor.set(0.5, 1); this.label.resolution = 2; this.label.alpha = 0.9;
    this.emote = new Text({ text: '', style: { fontSize: 18, fill: 0xe8e4dc } }); this.emote.anchor.set(0.5, 1); this.emote.visible = false; this.emote.resolution = 2;
    this.glow = new Sprite(bank.lightSoft); this.glow.anchor.set(0.5); this.glow.blendMode = 'add'; this.glow.tint = 0x8fa3c0; this.glow.alpha = 0; this.glow.scale.set(0.6);
    this.root.addChild(this.shadow, this.ring, this.body, this.bars, this.label, this.emote);
  }

  private tex(pose: 'stand' | 'walkA' | 'walkB' | 'sit', ghost: boolean): Baked { return this.bank.avatar(this.app, pose, ghost, this.seat); }
  setName(name: string) { if (this.label.text !== name) this.label.text = name; }
  setPos(x: number, y: number) { this.x = x; this.y = y; }
  walkTo(x: number, y: number, onArrive?: () => void) { this.target = { x, y }; this.onArrive = onArrive ?? null; }
  showEmote(s: string) { this.emote.text = s; this.emote.visible = true; this.emoteT = 2.2; }
  get isGhost() { return this.mode === 'ghost'; }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy();
    this.bank.releaseAvatar(this.seat);
  }

  update(dt: number, labelScale: number, dir?: { x: number; y: number }, walkable?: (x: number, y: number) => boolean) {
    this.t += dt;
    const ghost = this.mode === 'ghost';
    let vx = 0, vy = 0;
    if (dir && (dir.x || dir.y)) { vx = dir.x * this.speed; vy = dir.y * this.speed * 0.85; this.target = null; }
    else if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
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
      this.walkPhase += dt * 5.5;
    } else if (this.mode === 'walk') this.mode = 'idle';
    this.pose(dt, labelScale);
  }

  applyPose(x: number, y: number, facing: 1 | -1, moving: boolean, dt: number, labelScale: number) {
    this.x = x; this.y = y; this.facing = facing; this.target = null;
    this.t += dt;
    this.moving = lerp(this.moving, moving ? 1 : 0, clamp(dt * 10, 0, 1));
    if (this.mode === 'idle' || this.mode === 'walk') this.mode = moving ? 'walk' : 'idle';
    if (moving) this.walkPhase += dt * 5.5;
    this.pose(dt, labelScale);
  }

  private pose(dt: number, labelScale: number) {
    const ghost = this.mode === 'ghost', seated = this.mode === 'seated', walking = this.mode === 'walk' && this.moving > 0.3;
    const tex = ghost ? this.tex('stand', true) : seated ? this.tex('sit', false) : walking ? this.tex(Math.floor(this.walkPhase) % 2 === 0 ? 'walkA' : 'walkB', false) : this.tex('stand', false);
    this.body.texture = tex.texture; this.body.anchor.set(tex.ax, tex.ay);
    const breathe = 1 + Math.sin(this.t * 1.4) * 0.006;
    const bob = ghost ? Math.sin(this.t * 1.6) * 4 : walking ? Math.abs(Math.sin(this.walkPhase * Math.PI)) * 2 : 0;
    this.body.scale.set(this.facing * SCALE, SCALE * breathe);
    this.body.y = (ghost ? -10 : 0) - bob;
    this.body.rotation = ghost ? Math.sin(this.t * 0.9) * 0.03 : seated ? Math.sin(this.t * 0.7) * 0.01 : 0;
    this.body.alpha = ghost ? 0.9 : 1;
    this.shadow.alpha = ghost ? 0.12 : 0.7;
    this.shadow.scale.set(ghost ? 0.8 : seated ? 1.1 : 1.0, ghost ? 0.3 : 0.42);
    this.glow.alpha = ghost ? 0.10 + Math.sin(this.t * 1.6) * 0.03 : 0;
    this.glow.position.set(this.x, this.y - 50);

    this.speakT = lerp(this.speakT, this.speaking ? 1 : 0, clamp(dt * 8, 0, 1));
    this.ring.visible = this.speakT > 0.02;
    this.ring.alpha = this.speakT * (0.55 + Math.sin(this.t * 5) * 0.15);
    this.ring.scale.set((1 + Math.sin(this.t * 5) * 0.04) * this.speakT);
    this.bars.visible = this.speakT > 0.02;
    this.bars.alpha = this.speakT * 0.9;
    this.bars.position.set(this.facing * 16, this.body.y - (seated ? 82 : 112) * SCALE - (ghost ? 10 : 0));
    this.bars.scale.set(0.8 + Math.sin(this.t * 9) * 0.05, 0.8 + Math.sin(this.t * 11) * 0.12);
    this.label.scale.set(labelScale);
    this.label.y = this.body.y - (seated ? 92 : 124) * SCALE - (ghost ? 10 : 0);
    this.label.style.fill = this.speaking ? 0xe0a458 : ghost ? 0xb8c4d4 : 0xe8e4dc;
    this.label.alpha = ghost ? 0.7 : 0.9;
    if (this.emoteT > 0) { this.emoteT -= dt; this.emote.y = this.label.y - 16 * labelScale - Math.sin((2.2 - this.emoteT) * 3) * 3; this.emote.scale.set(labelScale); this.emote.alpha = clamp(this.emoteT * 2, 0, 1); if (this.emoteT <= 0) this.emote.visible = false; }

    this.root.position.set(this.x, this.y);
    this.root.zIndex = ghost ? this.y + 400 : this.y;
    this.root.visible = this.mode !== 'hidden' && this.alpha > 0.01;
    this.root.alpha = this.alpha;
    this.glow.visible = this.root.visible && ghost;
  }
}
