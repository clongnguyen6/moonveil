// Prop and effect sprites painted on Canvas2D: soft shading, no outlines. Returns canvases; the bank turns them into textures.
import { Noise } from '../noise.ts';
import { Rng } from '../rng.ts';

export interface Painted { canvas: HTMLCanvasElement; ax: number; ay: number }   // anchor as a fraction

function cv(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; }
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
function shade(n: number, f: number) { const r = Math.min(255, ((n >> 16) & 255) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f); return `rgb(${r | 0},${g | 0},${b | 0})`; }

// A-frame tent facing the viewer; `lit` adds a warm interior glow through the door and fabric.
export function paintTent(color: number, lit: boolean, S = 2): Painted {
  const w = 150, h = 110; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  const bx = w / 2, by = h - 12;
  // ground shadow
  const sg = c.createRadialGradient(bx, by, 0, bx, by, 72); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.save(); c.translate(bx, by); c.scale(1, 0.3); c.beginPath(); c.arc(0, 0, 72, 0, 6.3); c.fill(); c.restore();
  // roof panels (receding)
  const roofL = c.createLinearGradient(bx - 60, by, bx, by - 80); roofL.addColorStop(0, shade(color, 0.55)); roofL.addColorStop(1, shade(color, 0.95));
  c.fillStyle = roofL; c.beginPath(); c.moveTo(bx - 56, by); c.lineTo(bx, by - 78); c.lineTo(bx - 10, by - 94); c.lineTo(bx - 70, by - 16); c.closePath(); c.fill();
  const roofR = c.createLinearGradient(bx, by - 80, bx + 70, by); roofR.addColorStop(0, shade(color, 1.05)); roofR.addColorStop(1, shade(color, 0.6));
  c.fillStyle = roofR; c.beginPath(); c.moveTo(bx + 56, by); c.lineTo(bx, by - 78); c.lineTo(bx + 10, by - 94); c.lineTo(bx + 70, by - 16); c.closePath(); c.fill();
  // ridge
  c.fillStyle = shade(color, 1.15); c.beginPath(); c.moveTo(bx - 10, by - 94); c.lineTo(bx + 10, by - 94); c.lineTo(bx, by - 78); c.closePath(); c.fill();
  // front face: fabric gradient, lit from the fire side (bottom warm), darker at the ground
  const front = c.createLinearGradient(0, by - 78, 0, by); front.addColorStop(0, shade(color, 1.0)); front.addColorStop(0.7, shade(color, 0.8)); front.addColorStop(1, shade(color, 0.5));
  c.fillStyle = front; c.beginPath(); c.moveTo(bx - 56, by); c.lineTo(bx + 56, by); c.lineTo(bx, by - 78); c.closePath(); c.fill();
  // fabric sheen along the seam
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by - 76); c.lineTo(bx - 54, by - 1); c.stroke();
  if (lit) {
    // warm light through the fabric
    const glow = c.createRadialGradient(bx, by - 30, 0, bx, by - 30, 60); glow.addColorStop(0, 'rgba(255,170,90,0.45)'); glow.addColorStop(1, 'rgba(255,150,70,0)');
    c.save(); c.beginPath(); c.moveTo(bx - 56, by); c.lineTo(bx + 56, by); c.lineTo(bx, by - 78); c.closePath(); c.clip(); c.fillStyle = glow; c.fillRect(0, 0, w, h); c.restore();
  }
  // door: open triangle with interior
  const door = c.createLinearGradient(0, by - 48, 0, by); door.addColorStop(0, lit ? '#6a4a2a' : '#0b0d10'); door.addColorStop(1, lit ? '#2a1c10' : '#05060a');
  c.fillStyle = door; c.beginPath(); c.moveTo(bx - 17, by); c.lineTo(bx + 17, by); c.lineTo(bx, by - 48); c.closePath(); c.fill();
  if (lit) { const lamp = c.createRadialGradient(bx + 1, by - 22, 0, bx + 1, by - 22, 26); lamp.addColorStop(0, 'rgba(255,200,120,0.9)'); lamp.addColorStop(0.3, 'rgba(255,170,90,0.5)'); lamp.addColorStop(1, 'rgba(255,150,70,0)'); c.fillStyle = lamp; c.fillRect(bx - 26, by - 48, 52, 50); }
  // door flap
  c.fillStyle = shade(color, 1.08); c.beginPath(); c.moveTo(bx - 17, by); c.lineTo(bx - 4, by); c.lineTo(bx + 3, by - 36); c.lineTo(bx, by - 48); c.closePath(); c.fill();
  // guy lines + pegs
  c.strokeStyle = 'rgba(220,210,190,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx - 56, by); c.lineTo(bx - 72, by + 8); c.moveTo(bx + 56, by); c.lineTo(bx + 72, by + 8); c.stroke();
  return { canvas, ax: 0.5, ay: by / h };
}

export function paintFirepit(S = 2): Painted {
  const w = 130, h = 80; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  const cx = w / 2, cy = h / 2 + 6;
  const pit = c.createRadialGradient(cx, cy, 4, cx, cy, 44); pit.addColorStop(0, '#2a1a12'); pit.addColorStop(0.5, '#1a1310'); pit.addColorStop(1, 'rgba(20,16,12,0)');
  c.fillStyle = pit; c.save(); c.translate(cx, cy); c.scale(1, 0.58); c.beginPath(); c.arc(0, 0, 50, 0, 6.3); c.fill(); c.restore();
  const emb = c.createRadialGradient(cx, cy + 2, 0, cx, cy + 2, 20); emb.addColorStop(0, 'rgba(255,120,40,0.9)'); emb.addColorStop(0.5, 'rgba(200,60,20,0.5)'); emb.addColorStop(1, 'rgba(120,30,10,0)');
  c.fillStyle = emb; c.save(); c.translate(cx, cy + 2); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, 22, 0, 6.3); c.fill(); c.restore();
  // logs
  for (const [rot, len] of [[0.3, 46], [-0.5, 44], [1.3, 40]] as const) {
    c.save(); c.translate(cx, cy - 2); c.rotate(rot); c.scale(1, 0.55);
    const g = c.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#5a3d28'); g.addColorStop(0.5, '#3b2819'); g.addColorStop(1, '#1e130c');
    c.fillStyle = g; c.beginPath(); c.roundRect(-len / 2, -6, len, 12, 5); c.fill(); c.restore();
  }
  // stones with shaded top
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2, x = cx + Math.cos(a) * 50, y = cy + Math.sin(a) * 28, r = 6.5 + ((i * 7) % 3) * 1.4;
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r); g.addColorStop(0, '#8a8580'); g.addColorStop(0.6, '#55514d'); g.addColorStop(1, '#2d2b29');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.72, 0, 0, 6.3); c.fill();
  }
  return { canvas, ax: 0.5, ay: cy / h };
}

export function paintSeat(kind: 'log' | 'stump', S = 2): Painted {
  const w = 70, h = 40; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  const sg = c.createRadialGradient(w / 2, h - 6, 0, w / 2, h - 6, 34); sg.addColorStop(0, 'rgba(0,0,0,0.4)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.save(); c.translate(w / 2, h - 6); c.scale(1, 0.35); c.beginPath(); c.arc(0, 0, 34, 0, 6.3); c.fill(); c.restore();
  if (kind === 'log') {
    const g = c.createLinearGradient(0, 10, 0, 34); g.addColorStop(0, '#5c4330'); g.addColorStop(0.45, '#3d2b1e'); g.addColorStop(1, '#1f150e');
    c.fillStyle = g; c.beginPath(); c.roundRect(6, 12, 58, 20, 9); c.fill();
    const e = c.createRadialGradient(62, 22, 1, 62, 22, 9); e.addColorStop(0, '#9a7a56'); e.addColorStop(1, '#4a3524'); c.fillStyle = e; c.beginPath(); c.ellipse(62, 22, 6, 9, 0, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 15); c.lineTo(58, 15); c.stroke();
  } else {
    const side = c.createLinearGradient(14, 0, 56, 0); side.addColorStop(0, '#2a1d14'); side.addColorStop(0.5, '#4a3524'); side.addColorStop(1, '#241810');
    c.fillStyle = side; c.beginPath(); c.roundRect(16, 12, 38, 22, 4); c.fill();
    const top = c.createRadialGradient(35, 12, 2, 35, 12, 20); top.addColorStop(0, '#a88a62'); top.addColorStop(1, '#5e4630'); c.fillStyle = top; c.beginPath(); c.ellipse(35, 12, 19, 9, 0, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(60,40,25,0.5)'; c.lineWidth = 1; c.beginPath(); c.ellipse(35, 12, 11, 5, 0, 0, 6.3); c.stroke(); c.beginPath(); c.ellipse(35, 12, 5, 2.3, 0, 0, 6.3); c.stroke();
  }
  return { canvas, ax: 0.5, ay: (h - 6) / h };
}

export function paintLanternPost(S = 2): Painted {
  const w = 40, h = 110; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  const g = c.createLinearGradient(14, 0, 22, 0); g.addColorStop(0, '#2b2219'); g.addColorStop(0.5, '#3f3226'); g.addColorStop(1, '#1b140e');
  c.fillStyle = g; c.beginPath(); c.roundRect(15, 14, 7, 94, 2); c.fill();
  c.fillStyle = '#2b2219'; c.fillRect(18, 16, 14, 3);
  const lamp = c.createLinearGradient(0, 18, 0, 34); lamp.addColorStop(0, '#5a4a30'); lamp.addColorStop(1, '#2a2218');
  c.fillStyle = lamp; c.beginPath(); c.roundRect(26, 18, 9, 15, 2); c.fill();
  c.fillStyle = 'rgba(255,200,120,0.85)'; c.fillRect(28, 22, 5, 8);
  return { canvas, ax: 18 / w, ay: 108 / h };
}

export function paintFlame(S = 2): HTMLCanvasElement {
  const w = 48, h = 90; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  const g = c.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(255,110,30,0)'); g.addColorStop(0.15, 'rgba(255,120,40,0.75)'); g.addColorStop(0.5, 'rgba(255,170,60,0.8)'); g.addColorStop(0.85, 'rgba(255,220,150,0.7)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, h); c.bezierCurveTo(-w * 0.05, h * 0.7, w * 0.25, h * 0.3, w / 2, 0); c.bezierCurveTo(w * 0.75, h * 0.3, w * 1.05, h * 0.7, w / 2, h); c.fill();
  const g2 = c.createLinearGradient(0, h, 0, h * 0.35); g2.addColorStop(0, 'rgba(255,230,160,0)'); g2.addColorStop(0.5, 'rgba(255,240,200,0.6)'); g2.addColorStop(1, 'rgba(255,250,230,0)');
  c.fillStyle = g2; c.beginPath(); c.moveTo(w / 2, h * 0.95); c.bezierCurveTo(w * 0.3, h * 0.75, w * 0.38, h * 0.5, w / 2, h * 0.35); c.bezierCurveTo(w * 0.62, h * 0.5, w * 0.7, h * 0.75, w / 2, h * 0.95); c.fill();
  return canvas;
}

export function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const [canvas, c] = cv(size, size); const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, col] of stops) g.addColorStop(t, col); c.fillStyle = g; c.fillRect(0, 0, size, size); return canvas;
}

// soft noise puff (mist / smoke), alpha only
export function paintPuff(size: number, seed: number, softness = 1): HTMLCanvasElement {
  const [canvas, c] = cv(size, size); const img = c.createImageData(size, size); const d = img.data; const n = new Noise(seed);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - size / 2) / (size / 2), dy = (y - size / 2) / (size / 2); const r = Math.hypot(dx, dy);
    const edge = Math.max(0, 1 - r); const v = n.fbm(x / size * 4 + seed, y / size * 4, 4);
    const a = Math.pow(edge, softness) * Math.max(0, v - 0.25) * 1.6;
    const k = (y * size + x) * 4; d[k] = 255; d[k + 1] = 255; d[k + 2] = 255; d[k + 3] = Math.round(Math.min(1, a) * 255);
  }
  c.putImageData(img, 0, 0); return canvas;
}

// film grain tile
export function paintGrain(size: number, seed: number): HTMLCanvasElement {
  const [canvas, c] = cv(size, size); const img = c.createImageData(size, size); const d = img.data; const rng = new Rng(seed);
  for (let i = 0; i < size * size; i++) { const v = 128 + (rng.next() - 0.5) * 255; const k = i * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255; }
  c.putImageData(img, 0, 0); return canvas;
}

// vertical light streak for water reflections
export function paintStreak(S = 2): HTMLCanvasElement {
  const w = 24, h = 110; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-in'; c.fillStyle = gx; c.fillRect(0, 0, w, h);
  return canvas;
}

export function paintRing(S = 2): Painted {
  const w = 72, h = 40; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(w / 2, h / 2, 30, 14, 0, 0, 6.3); c.stroke();
  return { canvas, ax: 0.5, ay: 0.5 };
}
export function paintSpeakBars(S = 2): Painted {
  const w = 22, h = 16; const [canvas, c] = cv(w * S, h * S); c.scale(S, S);
  c.fillStyle = '#fff'; for (const [x, hh] of [[3, 6], [9, 12], [15, 8]] as const) { c.beginPath(); c.roundRect(x, (h - hh) / 2, 3.5, hh, 1.5); c.fill(); }
  return { canvas, ax: 0.5, ay: 0.5 };
}
export function paintShadow(size = 64): HTMLCanvasElement { return radial(size, [[0, 'rgba(0,0,0,0.5)'], [0.6, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,0)']]); }
export const hexColor = hex;

// soft ripple tile for the water shimmer (alpha only, tileable by mirroring)
export function paintRipple(size: number, seed: number): HTMLCanvasElement {
  const [canvas, c] = cv(size, size); const img = c.createImageData(size, size); const d = img.data; const n = new Noise(seed);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const fx = Math.sin(u * Math.PI) ** 1 , fy = Math.sin(v * Math.PI);        // fade at the edges so tiles never show seams
    const val = n.fbm(u * 3 + seed, v * 9, 3);
    const a = Math.max(0, val - 0.45) * 2.2 * Math.min(1, fx * 2) * Math.min(1, fy * 2);
    const k = (y * size + x) * 4; d[k] = 255; d[k + 1] = 255; d[k + 2] = 255; d[k + 3] = Math.round(Math.min(1, a) * 255);
  }
  c.putImageData(img, 0, 0); return canvas;
}

// Foreground framing: a dark, soft-edged tree silhouette (trunk + foliage) painted at low res and upscaled.
export function paintForeground(seed: number, flip: boolean): HTMLCanvasElement {
  const w = 220, h = 300; const [small, sc] = cv(w, h); const n = new Noise(seed); const rng = new Rng(seed);
  sc.save(); if (flip) { sc.translate(w, 0); sc.scale(-1, 1); }
  const ink = (a: number) => `rgba(6,10,8,${a})`;
  sc.fillStyle = ink(0.95); sc.beginPath(); sc.moveTo(10, h); sc.quadraticCurveTo(26, h * 0.5, 40, 0); sc.lineTo(90, 0); sc.quadraticCurveTo(60, h * 0.5, 70, h); sc.closePath(); sc.fill();
  for (let i = 0; i < 26; i++) {
    const x = rng.range(20, w * 0.9), y = rng.range(0, h * 0.6), r = rng.range(22, 54) * (0.8 + n.value(x * 0.05, y * 0.05) * 0.5);
    const g = sc.createRadialGradient(x, y, r * 0.2, x, y, r); g.addColorStop(0, ink(0.9)); g.addColorStop(0.7, ink(0.7)); g.addColorStop(1, ink(0));
    sc.fillStyle = g; sc.beginPath(); sc.arc(x, y, r, 0, 6.3); sc.fill();
  }
  sc.restore();
  const [big, bc] = cv(w * 2, h * 2); bc.filter = 'blur(2px)'; bc.drawImage(small, 0, 0, w * 2, h * 2);
  return big;
}
