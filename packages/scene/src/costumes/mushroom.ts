import type { Costume } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';

export const mushroom: Costume = {
  id: 'mushroom',
  top: M.bark,
  hidesHat: true,
  hidesHair: false,
  crownY: (choice) => choice.hat === 'mushroomCap' ? -89 : -75,
  pieces: {
    back: (ctx) => {
      if (ctx.choice.back !== 'woodPack') return;
      const { b, rig } = ctx;
      const shoulder = rig.shoulderY;
      b.roundRect(-25, shoulder + 5, 14, 24, 3);
      paint(ctx, M.bark);
      // Three broad wooden slats and one strap, not fine wood grain.
      for (const y of [shoulder + 13, shoulder + 21]) {
        b.moveTo(-24, y).lineTo(-12, y).stroke(ctx.color(ctx.outline(M.bark)), 1.3);
      }
      b.moveTo(-19, shoulder + 7).lineTo(-19, shoulder + 27)
        .stroke(ctx.color(M.sand), 2);
    },
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'mushroomCap') return;
      ctx.b.ellipse(ctx.rig.head.x, ctx.rig.head.y - 9, 18, 4);
      paint(ctx, M.oatmeal, 1.6);
    },
    front: (ctx) => {
      if (ctx.choice.front !== 'scarf') return;
      const { b, rig } = ctx;
      b.roundRect(5, rig.shoulderY + 4, 7, 13, 2);
      paint(ctx, M.sand, 1.5);
      b.roundRect(-14, rig.shoulderY - 1, 28, 7, 3);
      paint(ctx, M.sand, 1.5);
    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'mushroomCap') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      b.ellipse(0, crown + 5, 19, 4);
      paint(ctx, M.oatmeal, 1.6);
      b.moveTo(-18, crown + 4).quadraticCurveTo(-16, crown - 12, 0, crown - 12)
        .quadraticCurveTo(17, crown - 12, 18, crown + 4)
        .quadraticCurveTo(0, crown - 1, -18, crown + 4).closePath();
      paint(ctx, M.ember);
      // Irregular broad patches: three shapes, no repeating polka-dot grid.
      b.ellipse(-8, crown - 4, 3.7, 2.6).fill(ctx.color(M.oatmeal));
      b.moveTo(2, crown - 8).quadraticCurveTo(9, crown - 9, 10, crown - 4)
        .quadraticCurveTo(5, crown - 1, 2, crown - 4).closePath().fill(ctx.color(M.oatmeal));
      b.ellipse(12, crown + 0.5, 2.5, 1.4).fill(ctx.color(M.oatmeal));
    },
  },
};
