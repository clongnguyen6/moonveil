import type { Costume } from '../rig.ts';
import { paint } from './materials.ts';

const SAND = 0xe0b23c;
const CLAY = 0xe08a3c;
const PINE = 0x3f8f7a;
const OATMEAL = 0xe9e0c8;
const INK = 0x2a2a30;
const FLOAT = 0xf0d7a0;

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
      const { b } = ctx;
      // Raised rear rim stays above stump tops; broad side lobes clear the torso.
      b.moveTo(-32, -39).quadraticCurveTo(-30, -44, 0, -44)
        .quadraticCurveTo(30, -44, 32, -39).lineTo(24, -37)
        .quadraticCurveTo(0, -43, -24, -37).closePath();
      paint(ctx, FLOAT, 2);

    },
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'duckCap') return;
      ctx.b.ellipse(ctx.rig.head.x, ctx.rig.head.y - 11, 17, 13);
      paint(ctx, SAND);
    },
    front: (ctx) => {
      if (ctx.choice.variant !== 'ring') return;
      const { b } = ctx;
      // Wide, raised front tube: chest remains the hole; hands/legs stay exposed.
      // Unlike the thin waist trim, the outer lobes survive stump occlusion.
      b.moveTo(-32, -39).quadraticCurveTo(-35, -37, -34, -33)
        .quadraticCurveTo(-32, -28, -25, -28)
        .quadraticCurveTo(0, -26, 25, -28)
        .quadraticCurveTo(32, -28, 34, -33)
        .quadraticCurveTo(35, -37, 32, -39).lineTo(24, -39)
        .quadraticCurveTo(22, -35, 16, -35)
        .quadraticCurveTo(0, -33, -16, -35)
        .quadraticCurveTo(-22, -35, -24, -39).closePath();
      paint(ctx, FLOAT, 2);
      b.moveTo(-27, -36).quadraticCurveTo(-24, -31, -16, -31)
        .quadraticCurveTo(0, -29, 16, -31)
        .stroke(ctx.color(OATMEAL), 2.4, 0.9);
      // Duck head is outside the arm, attached to the near tube rather than hidden behind it.
      b.roundRect(24, -40, 7, 10, 3);
      paint(ctx, SAND, 1.6);
      b.circle(27, -39, 5);
      paint(ctx, SAND, 1.6);
      b.moveTo(31, -40).quadraticCurveTo(37, -41, 38, -38)
        .quadraticCurveTo(37, -35, 31, -36).closePath();
      paint(ctx, CLAY, 1.6);
      b.circle(28.5, -40.5, 1.3).fill(ctx.color(INK));

    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'duckCap') return;
      const { b, rig } = ctx;
      const crown = rig.head.y - rig.head.r;
      b.moveTo(-16, crown + 8).quadraticCurveTo(-16, crown - 9, 0, crown - 9)
        .quadraticCurveTo(16, crown - 9, 17, crown + 7).lineTo(8, crown + 5)
        .quadraticCurveTo(-2, crown + 2, -16, crown + 8).closePath();
      paint(ctx, SAND);
      // Broad rounded bill, orange upper/lower lobes, kept above the human eyes.
      b.moveTo(-7, crown + 4).quadraticCurveTo(4, crown - 1, 16, crown + 2)
        .quadraticCurveTo(19, crown + 3, 19, crown + 6)
        .quadraticCurveTo(18, crown + 11, 6, crown + 10)
        .lineTo(-7, crown + 8).closePath();
      paint(ctx, CLAY, 1.6);
      b.moveTo(1, crown + 7).quadraticCurveTo(9, crown + 8, 16, crown + 6)
        .stroke(ctx.outline(CLAY), 1.4);
      b.circle(4, crown - 3, 1.7).fill(ctx.color(INK));
      b.circle(11, crown - 3, 1.5).fill(ctx.color(INK));

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
