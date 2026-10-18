// Deliberately plain placeholder costume: proves the four layers, the ghost mapping, motion and label clearance.
// Not art. Replace with real themes (art-themes owner).
import type { Costume } from '../rig.ts';

export const placeholder: Costume = {
  id: 'placeholder',
  options: { variants: ['default'], colors: ['slate'], hats: ['none'], fronts: ['none'], backs: ['none'] },
  top: 0x6a7f94,            // slate body colour
  crownY: -92,              // tallest point of the cap (label clearance uses this)
  pieces: {
    back: ({ b, color, outline }) => {
      // flat back plate behind the torso
      b.roundRect(-20, -46, 10, 24, 4).fill(color(0x4f5b6a)).stroke(outline(0x4f5b6a));
    },
    hoodBack: ({ b, color, rig }) => {
      // thin collar ring behind the head
      b.ellipse(rig.head.x, rig.head.y + 10, 13, 5).fill(color(0x8a97a8));
    },
    front: ({ b, color, outline }) => {
      // small square badge on the chest
      b.roundRect(2, -40, 8, 8, 2).fill(color(0xd9c38a)).stroke(outline(0xd9c38a));
    },
    hatFront: ({ b, color, outline, rig }) => {
      // tall plain cap: a rounded column from the crown up to crownY, narrower than the arcs band
      const top = -92, base = rig.head.y - 9;
      b.moveTo(-12, base).quadraticCurveTo(-13, top, 0, top).quadraticCurveTo(13, top, 12, base).closePath().fill(color(0x5c6e82)).stroke(outline(0x5c6e82));
      b.roundRect(-13, base - 2, 26, 5, 2).fill(color(0x4a5a6a));
    },
  },
};
