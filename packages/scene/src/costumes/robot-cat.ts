import type { Costume } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';

export const robotCat: Costume = {
  id: 'robotCat',
  options: {
    variants: ['default'],
    colors: ['river', 'slate'],
    hats: ['robotHood', 'none'],
    fronts: ['utilityPocket', 'none'],
    backs: ['none'],
  },
  top: M.river,
  hidesHair: false,
  crownY: (choice) => choice.hat === 'robotHood' ? -84 : -75,
  pieces: {
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'robotHood') return;
      ctx.b.ellipse(ctx.rig.head.x, ctx.rig.head.y - 1, 19, 21);
      paint(ctx, M.river);
    },
    front: (ctx) => {
      if (ctx.choice.front !== 'utilityPocket') return;
      const { b, rig } = ctx;
      // Offset rectangular utility pocket: no white belly or round pouch.
      b.roundRect(0, rig.torso.y + 9, 11, 12, 2);
      paint(ctx, M.slate, 1.5);
      b.roundRect(0, rig.torso.y + 9, 11, 4, 1);
      paint(ctx, M.slate, 1.2);
      b.moveTo(2, rig.torso.y + 15).lineTo(2, rig.torso.y + 19)
        .stroke(ctx.color(M.oatmeal), 1);
      b.circle(8, rig.torso.y + 11, 0.7).fill(ctx.color(M.oatmeal));
    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'robotHood') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      b.moveTo(-18, crown + 10).quadraticCurveTo(-19, crown - 7, 0, crown - 7)
        .quadraticCurveTo(19, crown - 7, 18, crown + 10).lineTo(15, crown + 10)
        .quadraticCurveTo(15, crown - 1, 0, crown - 1)
        .quadraticCurveTo(-15, crown - 1, -15, crown + 10).closePath();
      paint(ctx, M.river);
      for (const side of [-1, 1]) {
        b.moveTo(side * 18, crown + 9)
          .quadraticCurveTo(side * 19, crown + 22, side * 15, crown + 31)
          .lineTo(side * 13, crown + 28)
          .quadraticCurveTo(side * 17, crown + 20, side * 15, crown + 11).closePath();
        paint(ctx, M.river);
      }
      // Low rectangular mechanical tabs, not a recognizable character's ears.
      for (const x of [-19, 14]) {
        b.roundRect(x, crown - 2, 5, 10, 2);
        paint(ctx, M.slate, 1.6);
        b.roundRect(x + 1, crown, 3, 6, 1).fill(ctx.color(M.oatmeal));
      }
      // Short offset cloth tab and silent bell; no neck collar or extra motion.
      b.roundRect(-18, crown + 18, 2, 4, 1).fill(ctx.color(M.bark));
      b.circle(-17, crown + 25, 3.2);
      paint(ctx, M.sand, 1.6);
      b.moveTo(-18.3, crown + 25.5).lineTo(-15.7, crown + 25.5)
        .stroke(ctx.outline(M.sand), 1);
    },
  },
};
