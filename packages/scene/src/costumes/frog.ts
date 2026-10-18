import type { Costume } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';

export const frog: Costume = {
  id: 'frog',
  options: {
    variants: ['default'],
    colors: ['pine', 'moss'],
    hats: ['frogHat', 'none'],
    fronts: ['raincoatPockets', 'none'],
    backs: ['leafPack', 'none'],
  },
  top: M.pine,
  hidesHair: false,
  crownY: (choice) => choice.hat === 'frogHat' ? -94 : -75,
  pieces: {
    back: (ctx) => {
      if (ctx.choice.back !== 'leafPack') return;
      const { b, rig } = ctx;
      const shoulder = rig.shoulderY;
      // Broad folded lotus leaf: the notch and outer lobes survive minification.
      b.moveTo(-20, shoulder + 13).lineTo(-27, shoulder + 16)
        .quadraticCurveTo(-29, shoulder - 1, -19, shoulder + 3)
        .quadraticCurveTo(-11, shoulder - 1, -10, shoulder + 10)
        .quadraticCurveTo(-8, shoulder + 19, -17, shoulder + 26)
        .quadraticCurveTo(-27, shoulder + 28, -28, shoulder + 17).closePath();
      paint(ctx, M.pine);
      b.moveTo(-20, shoulder + 13).quadraticCurveTo(-17, shoulder + 14, -17, shoulder + 23)
        .stroke(ctx.color(M.moss), 1.5);
      b.moveTo(-20, shoulder + 13).lineTo(-24, shoulder + 6)
        .stroke(ctx.color(M.moss), 1.2);
    },
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'frogHat') return;
      ctx.b.ellipse(ctx.rig.head.x, ctx.rig.head.y - 10, 17, 13);
      paint(ctx, M.moss);
    },
    front: (ctx) => {
      if (ctx.choice.front !== 'raincoatPockets') return;
      const { b, rig } = ctx;
      // These are coat details; the base torso and hand geometry stays intact.
      for (const x of [-11, 3]) {
        b.roundRect(x, rig.torso.y + 13, 8, 8, 2);
        paint(ctx, M.pine, 1.5);
      }
      b.moveTo(0, rig.torso.y + 3).lineTo(0, rig.torso.y + 28)
        .stroke(ctx.outline(M.pine), 1.2);
      for (const y of [-40, -31, -22]) b.circle(0, y, 0.8).fill(ctx.color(M.oatmeal));
    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'frogHat') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      b.moveTo(-17, crown + 8).quadraticCurveTo(-17, crown - 10, 0, crown - 10)
        .quadraticCurveTo(17, crown - 10, 17, crown + 8)
        .quadraticCurveTo(0, crown + 3, -17, crown + 8).closePath();
      paint(ctx, M.moss);
      for (const x of [-10, 10]) {
        b.circle(x, crown - 11, 6.5);
        paint(ctx, M.moss);
        b.circle(x + 0.5, crown - 11, 4).fill(ctx.color(M.oatmeal));
        b.circle(x + 1.3, crown - 10.8, 1.8).fill(ctx.color(M.ink));
      }
      b.moveTo(-18, crown + 8).quadraticCurveTo(0, crown + 3, 18, crown + 8)
        .quadraticCurveTo(0, crown + 12, -18, crown + 8).closePath();
      paint(ctx, M.pine, 1.6);
    },
  },
};
