import type { CostumeContext } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';

export function pufferHoodBack(ctx: CostumeContext) {
  ctx.b.ellipse(ctx.rig.head.x, ctx.rig.head.y - 11, 17, 14);
  paint(ctx, M.sand);
}

export function pufferHatFront(ctx: CostumeContext) {
  const { b, rig } = ctx;
  const crown = rig.head.y - rig.head.r;
  b.moveTo(-16, crown + 7).quadraticCurveTo(-18, crown - 11, 0, crown - 11)
    .quadraticCurveTo(18, crown - 11, 17, crown + 7)
    .quadraticCurveTo(9, crown + 2, 0, crown + 2)
    .quadraticCurveTo(-8, crown + 1, -16, crown + 7).closePath();
  paint(ctx, M.sand);
  // Soft fins belong to the hat, never to the camper's arms.
  for (const side of [-1, 1]) {
    b.moveTo(side * 15, crown + 1)
      .quadraticCurveTo(side * 19, crown - 5, side * 19, crown + 2)
      .quadraticCurveTo(side * 18, crown + 8, side * 15, crown + 5).closePath();
    paint(ctx, M.sand, 1.6);
  }
  for (const x of [-9, 8]) {
    b.circle(x, crown - 3, 3.4).fill(ctx.color(M.oatmeal));
    b.circle(x + 0.7, crown - 2.7, 1.4).fill(ctx.color(M.ink));
  }
  b.ellipse(0, crown + 1, 2.8, 1.5).fill(ctx.color(M.bark));
}
