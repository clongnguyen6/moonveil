// All art is procedural: drawn with Pixi Graphics / Canvas2D and baked to textures at startup.
import { Graphics, Renderer, Texture, Sprite, Container } from 'pixi.js';
import { Rng, hsl, shade } from './rng';

export interface Baked { texture: Texture; ax: number; ay: number }

export function spriteOf(b: Baked): Sprite {
  const s = new Sprite(b.texture);
  s.anchor.set(b.ax, b.ay);
  return s;
}

export class TextureBank {
  readonly pine: Baked[] = [];
  readonly roundTree: Baked[] = [];
  readonly rock: Baked[] = [];
  readonly bush: Baked[] = [];
  readonly stump!: Baked;
  readonly log!: Baked;
  readonly tents = new Map<number, Baked>();
  readonly bridge!: Baked;
  readonly lanternPost!: Baked;
  readonly firepit!: Baked;
  readonly tuft!: Baked;
  readonly flower!: Baked;
  readonly flame!: Texture;
  readonly smoke!: Texture;
  readonly dot!: Texture;      // soft dot: sparks, fireflies, glints
  readonly light!: Texture;    // radial light for the lightmap
  readonly lightSoft!: Texture;
  readonly shadow!: Texture;
  readonly vignette!: Texture;
  readonly ripple!: Texture;
  readonly fog!: Texture;
  readonly ring!: Baked;
  readonly speakArcs!: Baked;

  constructor(private renderer: Renderer) {
    const rng = new Rng(7);
    for (let i = 0; i < 3; i++) this.pine.push(this.bake(drawPine(rng, i), 0, 0));
    for (let i = 0; i < 2; i++) this.roundTree.push(this.bake(drawRoundTree(rng, i), 0, 0));
    for (let i = 0; i < 3; i++) this.rock.push(this.bake(drawRock(rng), 0, 0));
    for (let i = 0; i < 2; i++) this.bush.push(this.bake(drawBush(rng, i), 0, 0));
    (this as any).stump = this.bake(drawStump(), 0, 0);
    (this as any).log = this.bake(drawLog(), 0, 0);
    (this as any).bridge = this.bake(drawBridge(), 0, 0);
    (this as any).lanternPost = this.bake(drawLanternPost(), 0, 0);
    (this as any).firepit = this.bake(drawFirepit(), 0, 0);
    (this as any).tuft = this.bake(drawTuft(), 0, 0);
    (this as any).flower = this.bake(drawFlower(), 0, 0);
    (this as any).ring = this.bake(drawRing(), 0, 0);
    (this as any).speakArcs = this.bake(drawSpeakArcs(), 0, 0);
    (this as any).flame = canvasTex(64, 96, drawFlameCanvas);
    (this as any).smoke = canvasTex(64, 64, (c) => radial(c, [[0, 'rgba(200,200,210,0.55)'], [0.6, 'rgba(200,200,210,0.18)'], [1, 'rgba(200,200,210,0)']]));
    (this as any).dot = canvasTex(32, 32, (c) => radial(c, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]));
    (this as any).light = canvasTex(256, 256, (c) => radial(c, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.75)'], [0.6, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]));
    (this as any).lightSoft = canvasTex(256, 256, (c) => radial(c, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]));
    (this as any).shadow = canvasTex(64, 64, (c) => radial(c, [[0, 'rgba(0,0,0,0.42)'], [0.7, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']]));
    (this as any).fog = canvasTex(256, 256, (c) => radial(c, [[0, 'rgba(210,220,255,0.35)'], [0.5, 'rgba(210,220,255,0.12)'], [1, 'rgba(210,220,255,0)']]));
    (this as any).vignette = canvasTex(256, 256, (c) => radial(c, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(5,8,12,0.85)']]));
    (this as any).ripple = canvasTex(256, 256, drawRippleCanvas);
  }

  tent(color: number): Baked {
    let b = this.tents.get(color);
    if (!b) { b = this.bake(drawTent(color), 0, 0); this.tents.set(color, b); }
    return b;
  }

  bake(target: Container, ox: number, oy: number, resolution = 2): Baked {
    const b = target.getLocalBounds();
    const texture = this.renderer.generateTexture({ target, resolution, antialias: true });
    return { texture, ax: (ox - b.minX) / Math.max(1, b.width), ay: (oy - b.minY) / Math.max(1, b.height) };
  }
}

// ---------- canvas helpers ----------
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d')!;
  draw(c, w, h);
  return Texture.from(canvas);
}
function radial(c: CanvasRenderingContext2D, stops: [number, string][]) {
  const w = c.canvas.width, h = c.canvas.height;
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  for (const [t, col] of stops) g.addColorStop(t, col);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function drawFlameCanvas(c: CanvasRenderingContext2D, w: number, h: number) {
  const g = c.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(255,120,30,0.0)');
  g.addColorStop(0.12, 'rgba(255,140,40,0.9)');
  g.addColorStop(0.5, 'rgba(255,190,70,0.95)');
  g.addColorStop(0.85, 'rgba(255,240,170,0.9)');
  g.addColorStop(1, 'rgba(255,255,220,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(w / 2, h);
  c.bezierCurveTo(-w * 0.1, h * 0.72, w * 0.2, h * 0.3, w / 2, 0);
  c.bezierCurveTo(w * 0.8, h * 0.3, w * 1.1, h * 0.72, w / 2, h);
  c.fill();
  // inner bright core
  const g2 = c.createLinearGradient(0, h, 0, h * 0.3);
  g2.addColorStop(0, 'rgba(255,230,140,0)');
  g2.addColorStop(0.4, 'rgba(255,245,200,0.8)');
  g2.addColorStop(1, 'rgba(255,255,230,0)');
  c.fillStyle = g2;
  c.beginPath();
  c.moveTo(w / 2, h * 0.95);
  c.bezierCurveTo(w * 0.25, h * 0.75, w * 0.35, h * 0.5, w / 2, h * 0.3);
  c.bezierCurveTo(w * 0.65, h * 0.5, w * 0.75, h * 0.75, w / 2, h * 0.95);
  c.fill();
}
function drawRippleCanvas(c: CanvasRenderingContext2D, w: number, h: number) {
  const rng = new Rng(21);
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, w), y = rng.range(0, h), len = rng.range(18, 48), a = rng.range(0.12, 0.3);
    c.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    c.lineWidth = rng.range(1.5, 3);
    for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h], [w, h], [-w, -h], [w, -h], [-w, h]]) {
      c.beginPath();
      c.moveTo(x + dx, y + dy);
      c.quadraticCurveTo(x + dx + len * 0.5, y + dy - 6, x + dx + len, y + dy);
      c.stroke();
    }
  }
}

// ---------- graphics art ----------
const OUT = { width: 2, alpha: 0.55, join: 'round' as const, cap: 'round' as const };
function outline(color: number) { return { ...OUT, color: shade(color, 0.55) }; }

function scallopedTriangle(g: Graphics, hw: number, yb: number, yt: number, color: number) {
  // triangle with bumpy bottom edge (illustrated pine tier)
  const bumps = 4; const step = (hw * 2) / bumps;
  g.moveTo(-hw, yb);
  for (let i = 0; i < bumps; i++) {
    const x0 = -hw + i * step;
    g.quadraticCurveTo(x0 + step / 2, yb + 9, x0 + step, yb);
  }
  g.lineTo(0, yt);
  g.closePath();
  g.fill(color).stroke(outline(color));
}

function drawPine(rng: Rng, variant: number): Graphics {
  const g = new Graphics();
  const hue = 128 + variant * 8 + rng.range(-6, 6);
  const dark = hsl(hue, 34, 23), mid = hsl(hue, 34, 29), light = hsl(hue - 8, 36, 36);
  const trunk = hsl(28, 30, 28);
  g.roundRect(-7, -34, 14, 36, 4).fill(trunk).stroke(outline(trunk));
  scallopedTriangle(g, 50, -30, -84, dark);
  scallopedTriangle(g, 40, -64, -116, mid);
  scallopedTriangle(g, 28, -98, -148, light);
  // left highlight
  g.poly([-50, -30, 0, -84, -8, -84, -40, -30]).fill({ color: 0xffffff, alpha: 0.08 });
  g.poly([-40, -64, 0, -116, -8, -116, -30, -64]).fill({ color: 0xffffff, alpha: 0.08 });
  g.poly([-28, -98, 0, -148, -6, -148, -20, -98]).fill({ color: 0xffffff, alpha: 0.1 });
  return g;
}

function drawRoundTree(rng: Rng, variant: number): Graphics {
  const g = new Graphics();
  const hue = 100 + variant * 12 + rng.range(-5, 5);
  const base = hsl(hue, 34, 32), lit = hsl(hue - 6, 38, 42);
  const trunk = hsl(28, 32, 30);
  g.roundRect(-8, -60, 16, 62, 5).fill(trunk).stroke(outline(trunk));
  g.circle(-30, -78, 30).fill(base);
  g.circle(30, -78, 30).fill(base);
  g.circle(0, -112, 34).fill(base);
  g.circle(0, -88, 42).fill(base);
  // single outline around the union: approximate with a soft darker stroke circles
  for (const [x, y, r] of [[-30, -78, 30], [30, -78, 30], [0, -112, 34], [0, -88, 42]] as const) {
    g.circle(x, y, r).stroke(outline(base));
  }
  g.circle(0, -88, 42).fill(base);
  g.circle(-30, -78, 30).fill(base);
  g.circle(30, -78, 30).fill(base);
  g.circle(0, -112, 34).fill(base);
  // highlights
  g.circle(-14, -118, 18).fill({ color: lit, alpha: 0.9 });
  g.circle(-30, -92, 14).fill({ color: lit, alpha: 0.7 });
  g.circle(10, -100, 10).fill({ color: lit, alpha: 0.5 });
  return g;
}

function drawBush(rng: Rng, variant: number): Graphics {
  const g = new Graphics();
  const hue = 110 + variant * 15;
  const base = hsl(hue, 32, 30), lit = hsl(hue, 36, 40);
  const r = 16 + rng.range(0, 6);
  g.ellipse(-14, -10, r, r * 0.8).fill(base).stroke(outline(base));
  g.ellipse(14, -10, r, r * 0.8).fill(base).stroke(outline(base));
  g.ellipse(0, -16, r * 1.2, r).fill(base).stroke(outline(base));
  g.ellipse(0, -16, r * 1.2, r).fill(base);
  g.ellipse(-14, -10, r, r * 0.8).fill(base);
  g.ellipse(14, -10, r, r * 0.8).fill(base);
  g.ellipse(-6, -22, r * 0.6, r * 0.45).fill({ color: lit, alpha: 0.8 });
  return g;
}

function drawRock(rng: Rng): Graphics {
  const g = new Graphics();
  const base = hsl(210, 8, 48), lit = hsl(210, 10, 62);
  const w = rng.range(18, 30), h = rng.range(12, 18);
  const pts: number[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + rng.range(-0.15, 0.15);
    pts.push(Math.cos(a) * w * r, -h + Math.sin(a) * h * r);
  }
  g.poly(pts).fill(base).stroke(outline(base));
  g.ellipse(-w * 0.25, -h - h * 0.25, w * 0.4, h * 0.3).fill({ color: lit, alpha: 0.8 });
  return g;
}

function drawStump(): Graphics {
  const g = new Graphics();
  const side = hsl(28, 30, 30), top = hsl(32, 36, 56), ring = hsl(30, 32, 46);
  g.roundRect(-18, -22, 36, 24, 5).fill(side).stroke(outline(side));
  g.ellipse(0, -22, 18, 10).fill(top).stroke(outline(side));
  g.ellipse(0, -22, 11, 6).stroke({ width: 1.5, color: ring, alpha: 0.9 });
  g.ellipse(0, -22, 5, 2.5).stroke({ width: 1.5, color: ring, alpha: 0.9 });
  return g;
}

function drawLog(): Graphics {
  const g = new Graphics();
  const side = hsl(26, 32, 32), end = hsl(32, 36, 56);
  g.roundRect(-30, -18, 60, 18, 8).fill(side).stroke(outline(side));
  g.roundRect(-30, -18, 60, 7, 4).fill({ color: 0xffffff, alpha: 0.08 });
  g.ellipse(30, -9, 6, 9).fill(end).stroke(outline(side));
  g.ellipse(30, -9, 3, 4.5).stroke({ width: 1.2, color: side, alpha: 0.7 });
  return g;
}

function drawTent(color: number): Graphics {
  const g = new Graphics();
  const front = color, roofL = shade(color, 1.18), roofR = shade(color, 0.82), inner = shade(color, 0.32);
  const mat = hsl(35, 22, 40);
  g.ellipse(0, -2, 60, 16).fill({ color: mat, alpha: 0.55 });
  // roof panels receding behind the ridge
  g.poly([-46, 0, 0, -64, -10, -78, -58, -14]).fill(roofL).stroke(outline(color));
  g.poly([46, 0, 0, -64, 10, -78, 58, -14]).fill(roofR).stroke(outline(color));
  g.poly([-58, -14, -10, -78, 10, -78, 58, -14, 0, -64]).fill(shade(color, 1.05));
  // front face
  g.poly([-46, 0, 46, 0, 0, -64]).fill(front).stroke(outline(color));
  // door opening with flap
  g.poly([-15, 0, 15, 0, 0, -40]).fill(inner);
  g.poly([-15, 0, -4, 0, 2, -30, 0, -40]).fill({ color: shade(color, 1.1) });
  // guy lines + pegs
  g.moveTo(-46, 0).lineTo(-62, 8).moveTo(46, 0).lineTo(62, 8).stroke({ width: 1.5, color: 0xe8e0d0, alpha: 0.6 });
  g.circle(-62, 8, 2).fill(0x9a8a70);
  g.circle(62, 8, 2).fill(0x9a8a70);
  return g;
}

function drawBridge(): Graphics {
  const g = new Graphics();
  const wood = hsl(30, 34, 42), dark = hsl(28, 30, 30), rail = hsl(30, 30, 36);
  // deck, slightly arched
  g.moveTo(-120, 22).quadraticCurveTo(0, -4, 120, 22).lineTo(120, -16).quadraticCurveTo(0, -42, -120, -16).closePath().fill(wood).stroke(outline(wood));
  for (let x = -108; x <= 108; x += 12) {
    const arch = 20 * (1 - (x / 120) ** 2);
    g.moveTo(x, 22 - arch * 0.9).lineTo(x, -16 - arch * 0.9).stroke({ width: 1.2, color: dark, alpha: 0.5 });
  }
  // rails (back and front)
  for (const [y0, y1] of [[-40, -16], [0, 22]] as const) {
    for (let x = -112; x <= 112; x += 56) {
      const arch = 20 * (1 - (x / 120) ** 2) * 0.9;
      g.roundRect(x - 3, y0 - arch - 8, 6, y1 - y0 + 8, 2).fill(rail).stroke(outline(rail));
    }
    g.moveTo(-120, y0 - 6).quadraticCurveTo(0, y0 - 30, 120, y0 - 6).stroke({ width: 5, color: rail, cap: 'round' });
  }
  return g;
}

function drawLanternPost(): Graphics {
  const g = new Graphics();
  const wood = hsl(28, 30, 30), metal = hsl(40, 10, 30), glass = hsl(42, 80, 72);
  g.roundRect(-4, -90, 8, 92, 3).fill(wood).stroke(outline(wood));
  g.moveTo(0, -88).lineTo(18, -88).stroke({ width: 4, color: wood, cap: 'round' });
  g.roundRect(12, -86, 12, 16, 3).fill(glass).stroke({ width: 2, color: metal, alpha: 0.9 });
  g.roundRect(13, -90, 10, 4, 1).fill(metal);
  return g;
}

function drawFirepit(): Graphics {
  const g = new Graphics();
  const stone = hsl(210, 6, 52), stoneD = hsl(210, 6, 36), ash = hsl(20, 10, 16), wood = hsl(26, 32, 30);
  g.ellipse(0, 0, 50, 30).fill(hsl(25, 20, 24));
  g.ellipse(0, 0, 40, 23).fill(ash);
  g.ellipse(0, 2, 24, 12).fill(hsl(15, 50, 22));
  // logs
  for (const rot of [0.35, -0.4, 1.2]) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts: number[] = [];
    for (const [x, y] of [[-24, -5], [24, -5], [24, 5], [-24, 5]]) pts.push(x * c - y * s * 0.5, (x * s + y * c) * 0.5 - 4);
    g.poly(pts).fill(wood).stroke(outline(wood));
  }
  // stone ring
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * 50, y = Math.sin(a) * 30;
    const r = 7 + ((i * 7) % 3) * 1.5;
    g.ellipse(x, y, r, r * 0.75).fill(i % 3 === 0 ? stoneD : stone).stroke(outline(stone));
    g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.4, r * 0.25).fill({ color: 0xffffff, alpha: 0.18 });
  }
  return g;
}

function drawTuft(): Graphics {
  const g = new Graphics();
  const c = hsl(100, 38, 36);
  for (const [dx, h] of [[-6, 10], [0, 14], [6, 9]] as const) {
    g.moveTo(dx, 0).quadraticCurveTo(dx + 2, -h * 0.6, dx + 3, -h).stroke({ width: 2.2, color: c, cap: 'round' });
  }
  return g;
}
function drawFlower(): Graphics {
  const g = new Graphics();
  g.moveTo(0, 0).lineTo(0, -8).stroke({ width: 1.5, color: hsl(100, 38, 36) });
  g.circle(0, -10, 3.2).fill(0xf2e6c8);
  g.circle(0, -10, 1.4).fill(0xf0c060);
  return g;
}
function drawRing(): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, 26, 14).stroke({ width: 3, color: 0xffffff });
  return g;
}
function drawSpeakArcs(): Graphics {
  const g = new Graphics();
  for (let i = 0; i < 3; i++) {
    const r = 6 + i * 6;
    g.arc(0, 0, r, -0.9, 0.9).stroke({ width: 2.4, color: 0xffffff, cap: 'round' });
  }
  return g;
}
