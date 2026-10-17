// Texture bank for direction-2: everything is painted on Canvas2D at load (see src/paint/*) and uploaded once.
import { Sprite, Texture, type Renderer } from 'pixi.js';
import { paintTent, paintFirepit, paintSeat, paintLanternPost, paintFlame, radial, paintPuff, paintGrain, paintStreak, paintRing, paintSpeakBars, paintShadow, type Painted } from './paint/sprites.ts';
import { paintAvatar, type Pose } from './paint/avatar.ts';
import type { SceneAppearance } from './types.ts';

export interface Baked { texture: Texture; ax: number; ay: number }

export function spriteOf(b: Baked): Sprite { const s = new Sprite(b.texture); s.anchor.set(b.ax, b.ay); return s; }

export class TextureBank {
  readonly firepit: Baked;
  readonly seatLog: Baked;
  readonly seatStump: Baked;
  readonly lanternPost: Baked;
  readonly ring: Baked;
  readonly speakBars: Baked;
  readonly flame: Texture;
  readonly dot: Texture;        // soft dot: embers, fireflies, lamp bulbs
  readonly light: Texture;      // radial for the lightmap and warm pools
  readonly lightSoft: Texture;
  readonly shadow: Texture;
  readonly vignette: Texture;
  readonly mist: Texture[] = [];
  readonly grain: Texture;
  readonly streak: Texture;
  private tents = new Map<string, { unlit: Baked; lit: Baked }>();
  private avatars = new Map<string, Baked>();
  private S: number;

  constructor(_renderer: Renderer, readonly low: boolean) {
    this.S = low ? 1 : 2;
    const S = this.S;
    this.firepit = bake(paintFirepit(S));
    this.seatLog = bake(paintSeat('log', S));
    this.seatStump = bake(paintSeat('stump', S));
    this.lanternPost = bake(paintLanternPost(S));
    this.ring = bake(paintRing(S));
    this.speakBars = bake(paintSpeakBars(S));
    this.flame = Texture.from(paintFlame(S));
    this.dot = Texture.from(radial(32, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]));
    this.light = Texture.from(radial(256, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.8)'], [0.55, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]));
    this.lightSoft = Texture.from(radial(256, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]));
    this.shadow = Texture.from(paintShadow(64));
    this.vignette = Texture.from(radial(256, [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(0,0,0,0)'], [0.8, 'rgba(4,6,8,0.55)'], [1, 'rgba(3,4,6,0.95)']]));
    for (let i = 0; i < (low ? 1 : 3); i++) this.mist.push(Texture.from(paintPuff(low ? 128 : 256, 20 + i, 1.4)));
    this.grain = Texture.from(paintGrain(128, 3));
    this.streak = Texture.from(paintStreak(S));
  }

  tent(color: number): { unlit: Baked; lit: Baked } {
    const key = color.toString(16);
    let t = this.tents.get(key);
    if (!t) { t = { unlit: bake(paintTent(color, false, this.S)), lit: bake(paintTent(color, true, this.S)) }; this.tents.set(key, t); }
    return t;
  }

  avatar(a: SceneAppearance, pose: Pose, ghost: boolean, seedKey: string): Baked {
    const key = `${seedKey}|${pose}|${ghost ? 'g' : 'n'}|${a.skin}${a.top}${a.hair}${a.hairColor}${a.hat}${a.extra}`;
    let b = this.avatars.get(key);
    if (!b) { const p = paintAvatar(a, pose, ghost, seedKey, this.low ? 2 : 3); b = { texture: Texture.from(p.canvas), ax: p.ax, ay: p.ay }; this.avatars.set(key, b); }
    return b;
  }

  releaseAvatar(seedKey: string) {
    for (const [k, b] of this.avatars) if (k.startsWith(seedKey + '|')) { b.texture.destroy(true); this.avatars.delete(k); }
  }
}

function bake(p: Painted): Baked { return { texture: Texture.from(p.canvas), ax: p.ax, ay: p.ay }; }
