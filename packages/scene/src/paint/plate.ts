// Landscape plate painter (Canvas2D at load). Paints ground, clearing, paths, stream, forest layers and far mist
// as one layered illustration per time of day. Not geometric fills: noise-modulated gradients, soft edges, depth bands.
import { Noise } from '../noise.ts';
import { Rng } from '../rng.ts';
import { WORLD, FIRE, BRIDGE_Y, streamX, type MapLayout, type Tree } from '../map.ts';

export type Variant = 'dusk' | 'night';
// The plate covers more than the world so portrait framing never shows its edge.
export const PLATE = { x: -400, y: -560, w: WORLD.w + 800, h: WORLD.h + 1200 } as const;

interface Pal {
  base: string; groundDark: [number, number, number]; groundLight: [number, number, number];
  clearing: string; path: string; water: [string, string, string]; bank: string; bankLight: string;
  far: [string, string]; mid: [string, string]; near: [string, string]; trunk: string; mist: string; shadow: string;
}
const PALETTES: Record<Variant, Pal> = {
  dusk: {
    base: '#1c2419', groundDark: [40, 50, 34], groundLight: [100, 104, 60], clearing: 'rgba(96,84,58,0.55)', path: 'rgba(92,78,52,0.5)',
    water: ['#263b3f', '#1b2d33', '#2c4448'], bank: '#4a4a3c', bankLight: '#6b6652',
    far: ['#4b5f5e', '#324445'], mid: ['#2f4634', '#223326'], near: ['#1b2a1e', '#101a13'], trunk: '#241b14', mist: 'rgba(150,170,180,', shadow: 'rgba(10,16,12,',
  },
  night: {
    base: '#0c1116', groundDark: [26, 34, 38], groundLight: [68, 80, 70], clearing: 'rgba(70,58,42,0.5)', path: 'rgba(60,52,40,0.45)',
    water: ['#1e2c38', '#141e28', '#243440'], bank: '#2e302e', bankLight: '#42433e',
    far: ['#34424a', '#223038'], mid: ['#1f2c28', '#14201a'], near: ['#101a14', '#0a120d'], trunk: '#120e0c', mist: 'rgba(120,140,160,', shadow: 'rgba(4,8,10,',
  },
};

export function paintPlate(map: MapLayout, variant: Variant, scale: number): HTMLCanvasElement {
  const pal = PALETTES[variant];
  const W = Math.round(PLATE.w * scale), H = Math.round(PLATE.h * scale);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d')!;
  const noise = new Noise(variant === 'night' ? 11 : 12);
  const rng = new Rng(5);
  c.fillStyle = pal.base; c.fillRect(0, 0, W, H);
  c.save(); c.scale(scale, scale); c.translate(-PLATE.x, -PLATE.y);   // world coords from here

  // 1. ground texture: fBm colour field at low resolution, upscaled (soft, painterly)
  {
    const res = 6; const gw = Math.ceil(PLATE.w / res), gh = Math.ceil(PLATE.h / res);
    const small = document.createElement('canvas'); small.width = gw; small.height = gh;
    const sc = small.getContext('2d')!; const img = sc.createImageData(gw, gh); const d = img.data;
    const cx = FIRE.x, cy = FIRE.y + 60;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const wx = PLATE.x + i * res, wy = PLATE.y + j * res;
      const n = noise.fbm(wx * 0.0035, wy * 0.0035, 4) * 0.7 + noise.fbm(wx * 0.02, wy * 0.02, 3) * 0.3;
      // darker with distance from the camp (vignette of the land itself) and darker toward the top (far)
      const dist = Math.hypot((wx - cx) / 900, (wy - cy) / 650);
      const falloff = Math.max(0, 1 - dist * 0.55) * (1 - Math.max(0, (cy - wy) / 2600));
      const t = Math.max(0, Math.min(1, n * 0.75 + 0.25)) * (0.35 + 0.65 * falloff);
      const k = (j * gw + i) * 4;
      d[k] = pal.groundDark[0] + (pal.groundLight[0] - pal.groundDark[0]) * t;
      d[k + 1] = pal.groundDark[1] + (pal.groundLight[1] - pal.groundDark[1]) * t;
      d[k + 2] = pal.groundDark[2] + (pal.groundLight[2] - pal.groundDark[2]) * t;
      d[k + 3] = 255;
    }
    sc.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(small, PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  }

  // 2. dappled shade: large soft dark patches (canopy shadow), fewer inside the clearing
  for (let i = 0; i < 140; i++) {
    const x = rng.range(PLATE.x, PLATE.x + PLATE.w), y = rng.range(PLATE.y, PLATE.y + PLATE.h);
    const inClearing = Math.hypot((x - FIRE.x) / 620, (y - FIRE.y) / 440) < 1;
    if (inClearing && rng.next() < 0.8) continue;
    const r = rng.range(60, 220);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, pal.shadow + (inClearing ? 0.12 : 0.28) + ')'); g.addColorStop(1, pal.shadow + '0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 3. clearing: trodden ground around the fire, soft noisy edge
  for (let i = 0; i < 3; i++) {
    const rx = 300 - i * 70, ry = 190 - i * 44;
    const g = c.createRadialGradient(FIRE.x, FIRE.y + 20, 0, FIRE.x, FIRE.y + 20, rx);
    g.addColorStop(0, pal.clearing); g.addColorStop(0.75, pal.clearing.replace(/[\d.]+\)$/, '0.25)')); g.addColorStop(1, pal.clearing.replace(/[\d.]+\)$/, '0)'));
    c.save(); c.translate(FIRE.x, FIRE.y + 20); c.scale(1, ry / rx); c.translate(-FIRE.x, -(FIRE.y + 20));
    c.fillStyle = g; c.fillRect(FIRE.x - rx, FIRE.y + 20 - rx, rx * 2, rx * 2); c.restore();
  }
  // worn paths: several low-alpha strokes with jittered width
  const path = (pts: [number, number][], w: number) => {
    for (let k = 0; k < 6; k++) {
      c.beginPath(); c.moveTo(pts[0]![0] + rng.range(-6, 6), pts[0]![1] + rng.range(-4, 4));
      for (let i = 1; i < pts.length; i++) c.quadraticCurveTo(pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * 0.5 + rng.range(-20, 20), pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * 0.5 + rng.range(-12, 12), pts[i]![0] + rng.range(-6, 6), pts[i]![1] + rng.range(-4, 4));
      c.strokeStyle = pal.path.replace(/[\d.]+\)$/, `${(0.09 + k * 0.02).toFixed(2)})`); c.lineWidth = w * (1.3 - k * 0.12); c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
    }
  };
  path([[FIRE.x + 110, FIRE.y + 40], [1050, 790], [streamX(BRIDGE_Y) - 130, BRIDGE_Y + 4]], 44);
  path([[FIRE.x - 30, FIRE.y + 130], [740, 1080], [760, WORLD.h + 60]], 40);
  path([[FIRE.x - 110, FIRE.y - 30], [560, 640], [470, 560]], 28);

  // 4. stream: banks, water gradient, depth line, soft edge highlights
  const band = (hw: number, step = 20) => { c.beginPath(); for (let y = PLATE.y; y <= PLATE.y + PLATE.h; y += step) { const x = streamX(y) - hw; y === PLATE.y ? c.moveTo(x, y) : c.lineTo(x, y); } for (let y = PLATE.y + PLATE.h; y >= PLATE.y; y -= step) c.lineTo(streamX(y) + hw, y); c.closePath(); };
  band(96); c.fillStyle = pal.bank; c.fill();
  band(78); c.fillStyle = pal.bankLight; c.fill();
  // pebbles: speckle the bank
  for (let i = 0; i < 900; i++) { const y = rng.range(PLATE.y, PLATE.y + PLATE.h); const side = rng.pick([-1, 1]); const x = streamX(y) + side * rng.range(62, 94); c.fillStyle = rng.next() < 0.5 ? pal.bank : 'rgba(255,255,255,0.08)'; c.beginPath(); c.ellipse(x, y, rng.range(1.5, 4), rng.range(1, 2.5), 0, 0, 6.3); c.fill(); }
  band(62); { const g = c.createLinearGradient(streamX(700) - 62, 0, streamX(700) + 62, 0); g.addColorStop(0, pal.water[0]); g.addColorStop(0.5, pal.water[1]); g.addColorStop(1, pal.water[2]); c.fillStyle = g; c.fill(); }
  // flow lines
  c.lineCap = 'round';
  for (let i = 0; i < 70; i++) { const y = rng.range(PLATE.y, PLATE.y + PLATE.h), x = streamX(y) + rng.range(-50, 50), len = rng.range(30, 90); c.strokeStyle = `rgba(255,255,255,${rng.range(0.03, 0.09).toFixed(3)})`; c.lineWidth = rng.range(1, 2.5); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + rng.range(-8, 8), y + len * 0.5, x + (streamX(y + len) - streamX(y)), y + len); c.stroke(); }
  // bank edge highlight (lit side) and shadow (far side)
  c.beginPath(); for (let y = PLATE.y; y <= PLATE.y + PLATE.h; y += 20) { const x = streamX(y) - 60; y === PLATE.y ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 2.5; c.stroke();
  c.beginPath(); for (let y = PLATE.y; y <= PLATE.y + PLATE.h; y += 20) { const x = streamX(y) + 60; y === PLATE.y ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.stroke();

  // 5. grass tufts near the clearing edge (short strokes), subtle
  for (let i = 0; i < 1200; i++) {
    const x = rng.range(PLATE.x, PLATE.x + PLATE.w), y = rng.range(PLATE.y, PLATE.y + PLATE.h);
    if (Math.abs(x - streamX(y)) < 100) continue;
    const dist = Math.hypot((x - FIRE.x) / 700, (y - FIRE.y) / 500);
    if (dist > 1.25 || dist < 0.3) continue;
    const l = rng.range(0.1, 0.22) * (variant === 'night' ? 0.6 : 1);
    c.strokeStyle = `rgba(${pal.groundLight[0] + 30},${pal.groundLight[1] + 30},${pal.groundLight[2]},${l.toFixed(2)})`; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + rng.range(-3, 3), y - rng.range(5, 12)); c.stroke();
  }

  // 5b. dusk: low warm light from the left, cooler to the right
  if (variant === 'dusk') {
    const g = c.createLinearGradient(PLATE.x, 0, PLATE.x + PLATE.w, 0);
    g.addColorStop(0, 'rgba(226,164,88,0.16)'); g.addColorStop(0.5, 'rgba(226,164,88,0.05)'); g.addColorStop(1, 'rgba(90,110,140,0.10)');
    c.fillStyle = g; c.fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  }
  // 6. forest: depth bands by screen y (far = top, small & misty; near = bottom, large & dark); a few hero trees near the camp
  const hero: Tree[] = [{ x: 150, y: 640, kind: 'round', variant: 0, scale: 1.9, phase: 0, tintMix: 0 }, { x: 1250, y: 1120, kind: 'round', variant: 0, scale: 1.7, phase: 0, tintMix: 0 }, { x: 440, y: 1220, kind: 'pine', variant: 0, scale: 1.6, phase: 0, tintMix: 0 }, { x: 1600, y: 330, kind: 'pine', variant: 0, scale: 1.7, phase: 0, tintMix: 0 }];
  const trees = [...map.trees, ...extraFar(rng), ...hero].sort((a, b) => a.y - b.y);
  for (const t of trees) {
    const depth = Math.max(0, Math.min(1, (t.y - PLATE.y) / PLATE.h));    // 0 far .. 1 near
    const [lit, dark] = depth < 0.3 ? pal.far : depth < 0.62 ? pal.mid : pal.near;
    const sizeK = 0.8 + depth * 0.5;
    drawTree(c, t, lit, dark, pal.trunk, sizeK, noise, pal.shadow);
  }

  // 7. far mist: pale band at the top, noise-broken; and a thin ground haze over the stream
  {
    const res = 8; const gw = Math.ceil(PLATE.w / res), gh = Math.ceil(PLATE.h / res);
    const small = document.createElement('canvas'); small.width = gw; small.height = gh;
    const sc = small.getContext('2d')!; const img = sc.createImageData(gw, gh); const d = img.data;
    const [mr, mg, mb] = pal.mist.match(/\d+/g)!.map(Number) as [number, number, number];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const wx = PLATE.x + i * res, wy = PLATE.y + j * res;
      const top = Math.max(0, 1 - (wy - PLATE.y) / 900);                              // far forest
      const streamHaze = Math.max(0, 1 - Math.abs(wx - streamX(wy)) / 260) * 0.35;
      const n = noise.fbm(wx * 0.003 + 7, wy * 0.004, 3);
      const a = Math.max(0, Math.min(1, (top * top * 0.55 + streamHaze) * (0.5 + n * 0.8))) * (variant === 'night' ? 0.55 : 0.4);
      const k = (j * gw + i) * 4; d[k] = mr; d[k + 1] = mg; d[k + 2] = mb; d[k + 3] = Math.round(a * 255);
    }
    sc.putImageData(img, 0, 0);
    c.drawImage(small, PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  }
  c.restore();
  return canvas;
}

function extraFar(rng: Rng): Tree[] {
  // dense far treeline beyond the map's own trees (top band), painted only
  const out: Tree[] = [];
  for (let i = 0; i < 160; i++) out.push({ x: rng.range(PLATE.x, PLATE.x + PLATE.w), y: rng.range(PLATE.y + 40, PLATE.y + 520), kind: rng.next() < 0.75 ? 'pine' : 'round', variant: 0, scale: rng.range(0.9, 1.4), phase: 0, tintMix: 0 });
  return out;
}

function drawTree(c: CanvasRenderingContext2D, t: Tree, lit: string, dark: string, trunk: string, k: number, noise: Noise, shadow: string) {
  const s = t.scale * k;
  // ground shadow
  const sg = c.createRadialGradient(t.x + 10 * s, t.y + 6, 0, t.x + 10 * s, t.y + 6, 40 * s);
  sg.addColorStop(0, shadow + '0.35)'); sg.addColorStop(1, shadow + '0)');
  c.fillStyle = sg; c.save(); c.translate(t.x + 10 * s, t.y + 6); c.scale(1, 0.4); c.beginPath(); c.arc(0, 0, 40 * s, 0, 6.3); c.fill(); c.restore();
  c.fillStyle = trunk; c.fillRect(t.x - 4 * s, t.y - 40 * s, 8 * s, 42 * s);
  if (t.kind === 'pine') {
    for (let tier = 0; tier < 3; tier++) {
      const yb = t.y - (26 + tier * 34) * s, yt = t.y - (80 + tier * 34) * s, hw = (46 - tier * 11) * s;
      const g = c.createLinearGradient(t.x - hw, yt, t.x + hw, yb); g.addColorStop(0, lit); g.addColorStop(0.45, dark); g.addColorStop(1, dark);
      c.fillStyle = g; c.beginPath(); c.moveTo(t.x, yt);
      const steps = 7;
      for (let i = 0; i <= steps; i++) { const u = i / steps; const x = t.x + hw * u, y = yt + (yb - yt) * u + noise.value(t.x * 0.1 + i, tier) * 10 * s; c.lineTo(x + (i === steps ? 0 : 0), y); }
      for (let i = steps; i >= 0; i--) { const u = i / steps; const x = t.x - hw * u, y = yt + (yb - yt) * u + noise.value(t.x * 0.1 + i + 50, tier) * 10 * s; c.lineTo(x, y); }
      c.closePath(); c.fill();
    }
  } else {
    const cy = t.y - 90 * s, r = 44 * s;
    const blobs: [number, number, number][] = [[0, 0, 1], [-0.6, 0.2, 0.7], [0.6, 0.25, 0.7], [0, -0.55, 0.75], [-0.35, -0.3, 0.6], [0.4, -0.35, 0.55]];
    for (const [bx, by, br] of blobs) {
      const x = t.x + bx * r, y = cy + by * r, rr = br * r * (0.9 + noise.value(x * 0.05, y * 0.05) * 0.25);
      const g = c.createRadialGradient(x - rr * 0.35, y - rr * 0.35, rr * 0.1, x, y, rr); g.addColorStop(0, lit); g.addColorStop(0.7, dark); g.addColorStop(1, dark);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, 6.3); c.fill();
    }
  }
}
