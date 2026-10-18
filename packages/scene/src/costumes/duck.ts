import type { Costume } from '../rig.ts';
import { paint } from './materials.ts';

const SAND = 0xe0b23c;
const CLAY = 0xe08a3c;
const PINE = 0x3f8f7a;
const OATMEAL = 0xe9e0c8;
const INK = 0x2a2a30;

export const duck: Costume = {
  id: 'duck',
  options: {
    variants: ['ring', 'plain'],
    colors: ['sand', 'clay'],
    hats: ['duckCap', 'none'],
    fronts: ['none'],
    backs: ['none'],
  },
  top: SAND,
  // A cap preserves the camper's hair, including when headgear is off.
  hidesHair: false,
  crownY: (choice) => choice.hat === 'duckCap' ? -92 : -75,
  pieces: {
    back: (ctx) => {
      if (ctx.choice.variant !== 'ring') return;
      const { b, rig } = ctx;
      const waist = rig.torso.y + rig.torso.h - 10;
      // Rear rim is a band, not a filled disk; the base occludes its middle.
      b.moveTo(-23, waist).quadraticCurveTo(-23, waist - 7, 0, waist - 7)
        .quadraticCurveTo(23, waist - 7, 23, waist).lineTo(21, waist)
        .quadraticCurveTo(21, waist - 3, 0, waist - 3)
        .quadraticCurveTo(-21, waist - 3, -21, waist).closePath();
      paint(ctx, SAND, 1.6);

      // Duck nub sits behind the right arm so it cannot cover the hand.
      b.roundRect(19, waist - 7, 5, 8, 2);
      paint(ctx, SAND, 1.6);
      b.circle(21.5, waist - 8, 3.5);
      paint(ctx, SAND, 1.6);
      b.moveTo(24, waist - 9).quadraticCurveTo(27, waist - 9, 27, waist - 7)
        .quadraticCurveTo(26, waist - 6, 24, waist - 6).closePath();
      paint(ctx, CLAY, 1.2);
      b.circle(22.5, waist - 9, 0.9).fill(ctx.color(INK));
    },
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'duckCap') return;
      ctx.b.ellipse(ctx.rig.head.x, ctx.rig.head.y - 11, 17, 13);
      paint(ctx, SAND);
    },
    front: (ctx) => {
      if (ctx.choice.variant !== 'ring') return;
      const { b, rig } = ctx;
      const waist = rig.torso.y + rig.torso.h - 10;
      // The concave inner edge clears both hand disks without redrawing skin.
      // The low central band leaves the legs and ghost tail visible.
      b.moveTo(-23, waist).quadraticCurveTo(-24, waist + 7, -19, waist + 8)
        .quadraticCurveTo(0, waist + 12, 19, waist + 8)
        .quadraticCurveTo(24, waist + 7, 23, waist).lineTo(22, waist)
        .quadraticCurveTo(23, waist + 6, 17, waist + 7)
        .quadraticCurveTo(0, waist + 10, -17, waist + 7)
        .quadraticCurveTo(-23, waist + 6, -22, waist).closePath();
      paint(ctx, SAND, 1.6);
      b.moveTo(-10, waist + 8.5).quadraticCurveTo(0, waist + 10, 10, waist + 8.5)
        .stroke(ctx.color(OATMEAL), 1.1, 0.7);
    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'duckCap') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      b.moveTo(-16, crown + 8).quadraticCurveTo(-16, crown - 9, 0, crown - 9)
        .quadraticCurveTo(16, crown - 9, 17, crown + 7).lineTo(8, crown + 5)
        .quadraticCurveTo(-2, crown + 2, -16, crown + 8).closePath();
      paint(ctx, SAND);
      // Short beak visor stays inside x=20, away from the speaking-arcs band.
      b.moveTo(-1, crown + 6).quadraticCurveTo(11, crown + 1, 18, crown + 6)
        .quadraticCurveTo(19, crown + 9, 15, crown + 10)
        .lineTo(0, crown + 9).closePath();
      paint(ctx, CLAY, 1.6);
      b.circle(5, crown - 2, 1.2).fill(ctx.color(INK));
      b.circle(11, crown - 2, 1).fill(ctx.color(INK));

      // One flat leaf laid over the crown; no sprout or extra silhouette.
      b.moveTo(-8, crown - 9).quadraticCurveTo(-5, crown - 16, 6, crown - 13)
        .quadraticCurveTo(10, crown - 10, 12, crown - 8)
        .quadraticCurveTo(2, crown - 4, -8, crown - 9).closePath();
      paint(ctx, PINE);
      b.moveTo(-5, crown - 9).quadraticCurveTo(2, crown - 10, 8, crown - 9)
        .stroke(ctx.outline(PINE), 1, 0.6);
    },
  },
};
