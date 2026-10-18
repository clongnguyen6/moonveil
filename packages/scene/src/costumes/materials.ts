import type { CostumeContext } from '../rig.ts';

export const MATERIAL = {
  moss: 0x6aa84f, pine: 0x3f8f7a, bark: 0xb07d4f, ember: 0xd9603b,
  sand: 0xe0b23c, slate: 0x6d7f94, oatmeal: 0xe9e0c8, ink: 0x2a2a30,
  rose: 0xcf7aa8, berry: 0xc44f6e, clay: 0xe08a3c,
  river: 0x3e9fc4,
} as const;

export function paint(ctx: CostumeContext, design: number, width = 2) {
  ctx.b.fill(ctx.color(design)).stroke(ctx.outline(design), width);
}
