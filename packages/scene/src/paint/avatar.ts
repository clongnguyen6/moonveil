// Adult avatars, everyday trekking clothes, ~7.5 heads tall, soft shading, no outlines, warm rim light on the facing side.
// Poses: stand, walkA/walkB (leg swing frames), sit (facing the fire). Ghost: faint silhouette.
import type { SceneAppearance } from '../types.ts';
import { hashString } from '../rng.ts';

export type Pose = 'stand' | 'walkA' | 'walkB' | 'sit';
export interface PaintedAvatar { canvas: HTMLCanvasElement; ax: number; ay: number; height: number }

const SKIN: Record<SceneAppearance['skin'], [string, string]> = {
  fair: ['#e8c9ad', '#b38f73'], light: ['#d9b48f', '#a27f5e'], tan: ['#b98a63', '#8a6243'], brown: ['#8d6243', '#5f3f2a'], deep: ['#5a3b2a', '#3a251a'],
};
// muted trekking palette per catalog id: distinct, never saturated
const JACKET: Record<SceneAppearance['top'], string> = {
  ember: '#8c4a30', moss: '#5a6a46', river: '#3f5c66', dusk: '#5c4f6e', sand: '#a08c62', berry: '#7a3f4a',
  pine: '#3c5a4c', slate: '#55606a', clay: '#8a6a4a', sky: '#48627e', bark: '#6a4e38', rose: '#8a5a66',
};
const HAIR: Record<SceneAppearance['hairColor'], string> = { black: '#1d1816', brown: '#4a3324', chestnut: '#6b4a30', blond: '#a88a5a', ink: '#15161c', red: '#7a3a26' };
const TROUSERS = ['#2d3138', '#3a3a30', '#2a3240', '#45403a', '#333a2c'];
const HATS = ['#3a3a3a', '#5a5248', '#2e3a46', '#6a5a3c', '#4a3e36'];

function mix(a: string, b: string, t: number): string {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16)), pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t)).join(',')})`;
}
const dark = (c: string, f: number) => mix(c, '#000000', f);
const light = (c: string, f: number) => mix(c, '#ffffff', f);

type Part = 'legs' | 'shoe' | 'torso' | 'arm' | 'head' | 'hair' | 'hat';

export function paintAvatar(a: SceneAppearance, pose: Pose, ghost: boolean, seedKey: string, S = 3): PaintedAvatar {
  const h = hashString(seedKey);
  const w = 64, H = pose === 'sit' ? 96 : 128;
  const canvas = document.createElement('canvas'); canvas.width = w * S; canvas.height = H * S;
  const c = canvas.getContext('2d')!; c.scale(S, S);
  const cx = w / 2, ground = H - 4;
  const skin = SKIN[a.skin], jacket = JACKET[a.top], hair = HAIR[a.hairColor];
  const trousers = TROUSERS[h % TROUSERS.length]!, hat = HATS[(h >>> 4) % HATS.length]!;
  const sit = pose === 'sit';
  const headR = 8.5, torsoH = 40, legH = sit ? 24 : 52;
  const hipY = ground - (sit ? 30 : legH + 6), shoulderY = hipY - torsoH, headY = shoulderY - 6 - headR;
  const swing = pose === 'walkA' ? 7 : pose === 'walkB' ? -7 : 0;
  const lean = sit ? 3 : 0;

  const drawFigure = (fill: (part: Part) => void) => {
    fill('legs');
    if (sit) {
      c.beginPath(); c.roundRect(cx - 10, hipY - 4, 30, 12, 5); c.fill();
      c.beginPath(); c.roundRect(cx + 10, hipY, 10, 30, 4); c.fill();
      c.beginPath(); c.roundRect(cx + 2, hipY + 2, 9, 28, 4); c.fill();
    } else {
      c.beginPath(); c.roundRect(cx - 11 + swing * 0.5, hipY, 10, legH, 4); c.fill();
      c.beginPath(); c.roundRect(cx + 1 - swing * 0.5, hipY, 10, legH, 4); c.fill();
    }
    fill('shoe');
    if (sit) { c.beginPath(); c.roundRect(cx + 9, ground - 6, 14, 6, 2); c.fill(); c.beginPath(); c.roundRect(cx + 1, ground - 6, 12, 6, 2); c.fill(); }
    else { c.beginPath(); c.roundRect(cx - 12 + swing * 0.5, ground - 6, 13, 6, 2); c.fill(); c.beginPath(); c.roundRect(cx - swing * 0.5, ground - 6, 13, 6, 2); c.fill(); }
    fill('torso');
    c.beginPath(); c.moveTo(cx - 15 + lean, shoulderY + 2); c.quadraticCurveTo(cx + lean, shoulderY - 4, cx + 15 + lean, shoulderY + 2);
    c.lineTo(cx + 13, hipY + 6); c.quadraticCurveTo(cx, hipY + 10, cx - 13, hipY + 6); c.closePath(); c.fill();
    fill('arm');
    c.beginPath(); c.roundRect(cx - 19 + lean, shoulderY + 4, 8, sit ? 26 : 34, 4); c.fill();
    c.beginPath(); c.roundRect(cx + 11 + lean, shoulderY + 4, 8, sit ? 26 : 34, 4); c.fill();
    fill('head');
    c.beginPath(); c.roundRect(cx - 3, headY + headR - 2, 6, 7, 2); c.fill();
    c.beginPath(); c.ellipse(cx, headY, headR, headR * 1.08, 0, 0, 6.3); c.fill();
    if (a.hat !== 'hood' && a.hair !== 'bald') {
      fill('hair');
      c.beginPath();
      if (a.hair === 'long') { c.ellipse(cx, headY - 2, headR + 1.5, headR + 1, 0, Math.PI, 2 * Math.PI); c.lineTo(cx + headR + 1, headY + 14); c.lineTo(cx - headR - 1, headY + 14); c.closePath(); c.fill(); }
      else if (a.hair === 'bun') { c.ellipse(cx, headY - 2, headR + 1, headR, 0, Math.PI, 2 * Math.PI); c.closePath(); c.fill(); c.beginPath(); c.arc(cx - 6, headY - headR - 1, 4, 0, 6.3); c.fill(); }
      else if (a.hair === 'curly') { c.ellipse(cx, headY - 3, headR + 2.5, headR + 1.5, 0, Math.PI * 0.9, 2.1 * Math.PI); c.closePath(); c.fill(); }
      else { c.ellipse(cx, headY - 2.5, headR + 1, headR - 0.5, 0, Math.PI * 0.95, 2.05 * Math.PI); c.closePath(); c.fill(); }
    }
    if (a.hat !== 'none' && a.hat !== 'flower') {
      fill('hat');
      if (a.hat === 'beanie') { c.beginPath(); c.ellipse(cx, headY - 3, headR + 1.5, headR + 1, 0, Math.PI, 2 * Math.PI); c.closePath(); c.fill(); c.fillRect(cx - headR - 1.5, headY - 4, headR * 2 + 3, 4); }
      else if (a.hat === 'cap') { c.beginPath(); c.ellipse(cx, headY - 3, headR + 1, headR - 0.5, 0, Math.PI, 2 * Math.PI); c.closePath(); c.fill(); c.beginPath(); c.roundRect(cx + 2, headY - 4, headR + 6, 2.5, 1); c.fill(); }
      else if (a.hat === 'bucket') { c.beginPath(); c.roundRect(cx - headR, headY - headR - 4, headR * 2, headR + 2, 2); c.fill(); c.beginPath(); c.roundRect(cx - headR - 4, headY - 4, headR * 2 + 8, 2.5, 1); c.fill(); }
      else if (a.hat === 'hood') { c.beginPath(); c.ellipse(cx, headY - 1, headR + 4, headR + 4, 0, 0, 6.3); c.fill(); }
    }
  };

  if (ghost) {
    for (const [ox, oy, al] of [[-1.2, 0.5, 0.12], [1.2, -0.5, 0.12], [0, 0, 0.42]] as const) {
      c.save(); c.translate(ox, oy);
      const g = c.createLinearGradient(0, headY - headR, 0, ground);
      g.addColorStop(0, `rgba(200,214,230,${al})`); g.addColorStop(0.75, `rgba(170,186,205,${al * 0.6})`); g.addColorStop(1, 'rgba(160,176,196,0)');
      c.fillStyle = g; drawFigure(() => { c.fillStyle = g; }); c.restore();
    }
    c.fillStyle = 'rgba(230,240,255,0.5)'; c.beginPath(); c.arc(cx + 2.5, headY, 1.1, 0, 6.3); c.fill(); c.beginPath(); c.arc(cx + 6, headY, 1.1, 0, 6.3); c.fill();
    return { canvas, ax: 0.5, ay: ground / H, height: H };
  }

  const partFill = (base: string, kind: 'cloth' | 'skin' | 'hair') => {
    const g = c.createLinearGradient(cx - 16, 0, cx + 16, 0);
    const d = kind === 'skin' ? 0.25 : 0.45, l = kind === 'hair' ? 0.08 : 0.18;
    g.addColorStop(0, dark(base, d)); g.addColorStop(0.55, base); g.addColorStop(1, light(base, l));
    return g;
  };
  drawFigure((part) => {
    c.fillStyle = part === 'legs' ? partFill(trousers, 'cloth') : part === 'shoe' ? '#1a1a1c' : part === 'torso' ? partFill(jacket, 'cloth') : part === 'arm' ? partFill(dark(jacket, 0.08), 'cloth')
      : part === 'head' ? partFill(skin[0], 'skin') : part === 'hair' ? partFill(hair, 'hair') : partFill(a.hat === 'hood' ? jacket : hat, 'cloth');
  });
  // jacket details, scarf / backpack straps
  c.fillStyle = dark(jacket, 0.3); c.beginPath(); c.moveTo(cx - 6 + lean, shoulderY); c.lineTo(cx + lean, shoulderY + 7); c.lineTo(cx + 6 + lean, shoulderY); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx + lean, shoulderY + 7); c.lineTo(cx + lean * 0.6, hipY + 4); c.stroke();
  if (a.extra === 'scarf') { c.fillStyle = light(jacket, 0.3); c.beginPath(); c.roundRect(cx - 11 + lean, shoulderY - 1, 22, 7, 3); c.fill(); }
  if (a.extra === 'backpack') { c.strokeStyle = '#2a2622'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 9 + lean, shoulderY + 3); c.lineTo(cx - 7, hipY); c.moveTo(cx + 9 + lean, shoulderY + 3); c.lineTo(cx + 7, hipY); c.stroke(); }
  if (a.hat === 'flower') { c.fillStyle = '#c9b89a'; c.beginPath(); c.arc(cx - 6, headY - headR + 1, 2.2, 0, 6.3); c.fill(); }
  // face: brow shadow, two small eyes toward the facing side
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(cx, headY - 2, headR - 1, 2.5, 0, 0, 6.3); c.fill();
  c.fillStyle = dark(skin[1], 0.5); c.beginPath(); c.arc(cx + 2.5, headY + 0.5, 1, 0, 6.3); c.fill(); c.beginPath(); c.arc(cx + 6, headY + 0.5, 1, 0, 6.3); c.fill();
  // warm rim light along the facing edge; ambient occlusion under the torso
  c.save(); c.globalCompositeOperation = 'source-atop';
  const rim = c.createLinearGradient(cx + 4, 0, cx + 18, 0); rim.addColorStop(0, 'rgba(255,170,90,0)'); rim.addColorStop(1, 'rgba(255,180,100,0.38)');
  c.fillStyle = rim; c.fillRect(cx, headY - headR - 8, 24, ground - headY + headR + 8);
  const ao = c.createLinearGradient(0, hipY, 0, hipY + 14); ao.addColorStop(0, 'rgba(0,0,0,0.25)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = ao; c.fillRect(cx - 16, hipY, 32, 14);
  c.restore();
  return { canvas, ax: 0.5, ay: ground / H, height: H };
}
