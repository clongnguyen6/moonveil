import type { CostumeContext } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';

export function sharkHoodBack(ctx: CostumeContext) {
  const { b, rig } = ctx;
  const crown = rig.head.y - rig.head.r;
  // A short swept felt fin, not pointed animal ears.
  b.moveTo(-12, crown - 4).quadraticCurveTo(-15, crown - 13, -9, crown - 14)
    .quadraticCurveTo(-3, crown - 12, 2, crown - 4).closePath();
  paint(ctx, M.slate);
  b.ellipse(rig.head.x, rig.head.y - 1, 19, 21);
  paint(ctx, M.slate);
}

export function sharkHatFront(ctx: CostumeContext) {
  const { b, rig } = ctx;
  const crown = rig.head.y - rig.head.r;
  // Separate narrow rim/cheek paths leave the original human face open.
  b.moveTo(-18, crown + 10).quadraticCurveTo(-19, crown - 7, 0, crown - 7)
    .quadraticCurveTo(19, crown - 7, 18, crown + 10).lineTo(15, crown + 10)
    .quadraticCurveTo(15, crown - 1, 0, crown - 1)
    .quadraticCurveTo(-15, crown - 1, -15, crown + 10).closePath();
  paint(ctx, M.slate);
  b.moveTo(-18, crown + 9).quadraticCurveTo(-21, crown + 22, -15, crown + 31)
    .lineTo(-13, crown + 28).quadraticCurveTo(-17, crown + 20, -15, crown + 11).closePath();
  paint(ctx, M.slate);
  b.moveTo(18, crown + 9).quadraticCurveTo(19, crown + 22, 15, crown + 31)
    .lineTo(13, crown + 28).quadraticCurveTo(17, crown + 20, 15, crown + 11).closePath();
  paint(ctx, M.slate);

  // Two blunt felt tabs are enough; no threatening tooth row or projecting snout.
  for (const x of [-10, 1]) {
    b.roundRect(x, crown + 1, 4, 5, 2).fill(ctx.color(M.oatmeal));
  }
  for (const x of [-8, 7]) {
    b.circle(x, crown - 3, 2.8).fill(ctx.color(M.oatmeal));
    b.circle(x + 0.8, crown - 3, 1.2).fill(ctx.color(M.ink));
  }
}
