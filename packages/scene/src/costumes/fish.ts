import type { Costume } from '../rig.ts';
import { MATERIAL as M, paint } from './materials.ts';
import { pufferHatFront, pufferHoodBack } from './puffer.ts';
import { sharkHatFront, sharkHoodBack } from './shark.ts';

export const fish: Costume = {
  id: 'fish',
  options: {
    variants: ['puffer', 'shark'],
    colors: ['clay', 'sand', 'slate', 'river'],
    hats: ['fishHeadgear', 'none'],
    fronts: ['none'],
    backs: ['none', 'finPouch'],
  },
  top: 0xe08a3c,
  hidesHair: false,
  crownY: (choice) => {
    if (choice.hat !== 'fishHeadgear') return -75;
    return choice.variant === 'puffer' ? -88 : choice.variant === 'shark' ? -91 : -75;
  },
  pieces: {
    back: (ctx) => {
      if (ctx.choice.back !== 'finPouch') return;
      const { b, rig } = ctx;
      const shoulder = rig.shoulderY;
      // A small canvas tail pouch works with either fish variant.
      b.moveTo(-13, shoulder + 8).quadraticCurveTo(-18, shoulder + 10, -22, shoulder + 5)
        .quadraticCurveTo(-26, shoulder + 3, -24, shoulder + 9)
        .lineTo(-21, shoulder + 13)
        .quadraticCurveTo(-25, shoulder + 17, -24, shoulder + 20)
        .quadraticCurveTo(-22, shoulder + 22, -18, shoulder + 17)
        .lineTo(-13, shoulder + 19).closePath();
      paint(ctx, M.slate, 1.6);
      b.moveTo(-21, shoulder + 13).lineTo(-15, shoulder + 13)
        .stroke(ctx.color(M.oatmeal), 1.2);
    },
    hoodBack: (ctx) => {
      if (ctx.choice.hat !== 'fishHeadgear') return;
      if (ctx.choice.variant === 'puffer') pufferHoodBack(ctx);
      if (ctx.choice.variant === 'shark') sharkHoodBack(ctx);
    },
    hatFront: (ctx) => {
      if (ctx.choice.hat !== 'fishHeadgear') return;
      if (ctx.choice.variant === 'puffer') pufferHatFront(ctx);
      if (ctx.choice.variant === 'shark') sharkHatFront(ctx);
    },
  },
};
