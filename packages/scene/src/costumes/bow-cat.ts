import type { Costume } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';

export const bowCat: Costume = {
  id: 'bowCat',
  options: {
    variants: ['default'],
    colors: ['rose', 'berry'],
    hats: ['catHood', 'none'],
    fronts: ['fishSling', 'none'],
    backs: ['none'],
  },
  top: M.rose,
  hidesHair: false,
  crownY: (choice) => choice.hat === 'catHood' ? -93 : -75,
  pieces: {
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'catHood') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      // Rounded canvas cat ears; human face and body remain unchanged.
      b.moveTo(-17, crown).lineTo(-16, crown - 12)
        .quadraticCurveTo(-16, crown - 16, -13, crown - 14)
        .lineTo(-4, crown - 6).closePath();
      paint(ctx, M.oatmeal);
      b.moveTo(5, crown - 6).lineTo(13, crown - 15)
        .quadraticCurveTo(16, crown - 16, 16, crown - 12)
        .lineTo(18, crown).closePath();
      paint(ctx, M.oatmeal);
      b.ellipse(rig.head.x, rig.head.y, 19, 22);
      paint(ctx, M.oatmeal);
    },
    front: (ctx) => {
      if (ctx.choice.front !== 'fishSling') return;
      const { b, rig } = ctx;
      b.moveTo(-12, rig.shoulderY + 1).quadraticCurveTo(-1, -38, 8, -31)
        .stroke(ctx.outline(M.oatmeal), 3.5);
      b.moveTo(-12, rig.shoulderY + 1).quadraticCurveTo(-1, -38, 8, -31)
        .stroke(ctx.color(M.oatmeal), 2);
      b.moveTo(10, -32).lineTo(15, -35)
        .quadraticCurveTo(17, -32, 15, -29).closePath();
      paint(ctx, M.clay, 1.6);
      b.ellipse(4, -32, 7, 4);
      paint(ctx, M.clay, 1.6);
      b.circle(0, -32, 0.9).fill(ctx.color(M.ink));
    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'catHood') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      b.moveTo(-18, crown + 11).quadraticCurveTo(-19, crown - 7, 0, crown - 7)
        .quadraticCurveTo(19, crown - 7, 18, crown + 11).lineTo(15, crown + 11)
        .quadraticCurveTo(15, crown, 0, crown)
        .quadraticCurveTo(-15, crown, -15, crown + 11).closePath();
      paint(ctx, M.oatmeal);
      for (const side of [-1, 1]) {
        b.moveTo(side * 18, crown + 9)
          .quadraticCurveTo(side * 19, crown + 22, side * 15, crown + 30)
          .lineTo(side * 13, crown + 27)
          .quadraticCurveTo(side * 16, crown + 20, side * 15, crown + 11).closePath();
        paint(ctx, M.oatmeal);
      }
      b.moveTo(-14, crown - 11).lineTo(-8, crown - 6).lineTo(-14, crown - 4)
        .closePath().fill(ctx.color(M.rose));
      b.moveTo(13, crown - 11).lineTo(15, crown - 4).lineTo(9, crown - 6)
        .closePath().fill(ctx.color(M.rose));
      // Berry bow is part of the hood, never a separate role/accessory marker.
      b.moveTo(-10, crown - 7).quadraticCurveTo(-18, crown - 14, -18, crown - 8)
        .quadraticCurveTo(-19, crown - 2, -10, crown - 5).closePath();
      paint(ctx, M.berry, 1.6);
      b.moveTo(-10, crown - 7).quadraticCurveTo(-4, crown - 14, -2, crown - 9)
        .quadraticCurveTo(0, crown - 4, -10, crown - 5).closePath();
      paint(ctx, M.berry, 1.6);
      b.roundRect(-11.5, crown - 8.5, 4, 4, 1.5);
      paint(ctx, M.berry, 1.2);
    },
  },
};
