// Seat-seeded cosmetic defaults. PURE and DOM-free: the server may import `@moonveil/scene/seed` to upgrade legacy
// {color, hat} appearances so restored campers look exactly as the scene drew them (ADR 0011 proposal).
// Never derived from a role: the only input is the seat id.
import { randomAppearance } from './appearance.ts';
import type { SceneAppearance } from './types.ts';

export interface SeededBody { skin: SceneAppearance['skin']; hair: SceneAppearance['hair']; hairColor: SceneAppearance['hairColor'] }
export interface SeededExtras { front: 'none' | 'scarf'; back: 'none' | 'backpack' }

export function seededBody(seat: string): SeededBody {
  const a = randomAppearance(seat);
  return { skin: a.skin, hair: a.hair, hairColor: a.hairColor };
}

// The single seat-seeded `extra` of today's scene, expressed in the proposed front/back slots.
export function seededExtras(seat: string): SeededExtras {
  const a = randomAppearance(seat);
  return { front: a.extra === 'scarf' ? 'scarf' : 'none', back: a.extra === 'backpack' ? 'backpack' : 'none' };
}
