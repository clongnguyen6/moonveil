// Appearance catalog helpers. Cosmetic only. Pure.
import { EXTRAS, HAIRS, HAIR_COLORS, HATS, SKINS, TOPS, type SceneAppearance } from './types.ts';
import { hashString } from './rng.ts';

export const TOP_COLORS: Record<SceneAppearance['top'], number> = {
  ember: 0xd9603b, moss: 0x6aa84f, river: 0x3e9fc4, dusk: 0x8e5fb3, sand: 0xe0b23c, berry: 0xc44f6e,
  pine: 0x3f8f7a, slate: 0x6d7f94, clay: 0xe08a3c, sky: 0x4f6fbf, bark: 0xb07d4f, rose: 0xcf7aa8,
};
export const SKIN_COLORS: Record<SceneAppearance['skin'], number> = { fair: 0xf6d3b5, light: 0xe8b894, tan: 0xc98f67, brown: 0xa06a46, deep: 0x6f4a33 };
export const HAIR_COLOR_VALUES: Record<SceneAppearance['hairColor'], number> = { black: 0x2b1d16, brown: 0x5a3825, chestnut: 0x9c6b3a, blond: 0xd9b36c, ink: 0x1f2430, red: 0xb33f2f };

// Twelve distinct presets for fixtures and previews.
export const PRESETS: SceneAppearance[] = [
  { skin: 'light', top: 'ember', hair: 'short', hairColor: 'black', hat: 'none', extra: 'none' },
  { skin: 'fair', top: 'pine', hair: 'long', hairColor: 'black', hat: 'none', extra: 'scarf' },
  { skin: 'tan', top: 'sky', hair: 'short', hairColor: 'brown', hat: 'cap', extra: 'none' },
  { skin: 'light', top: 'sand', hair: 'bun', hairColor: 'black', hat: 'none', extra: 'backpack' },
  { skin: 'fair', top: 'dusk', hair: 'curly', hairColor: 'chestnut', hat: 'none', extra: 'none' },
  { skin: 'brown', top: 'berry', hair: 'short', hairColor: 'ink', hat: 'beanie', extra: 'none' },
  { skin: 'light', top: 'moss', hair: 'long', hairColor: 'blond', hat: 'bucket', extra: 'none' },
  { skin: 'tan', top: 'clay', hair: 'bald', hairColor: 'black', hat: 'none', extra: 'scarf' },
  { skin: 'fair', top: 'river', hair: 'curly', hairColor: 'red', hat: 'none', extra: 'backpack' },
  { skin: 'deep', top: 'bark', hair: 'short', hairColor: 'black', hat: 'hood', extra: 'none' },
  { skin: 'light', top: 'rose', hair: 'bun', hairColor: 'brown', hat: 'flower', extra: 'none' },
  { skin: 'brown', top: 'slate', hair: 'short', hairColor: 'black', hat: 'cap', extra: 'backpack' },
];

export function randomAppearance(seedKey: string): SceneAppearance {
  const h = hashString(seedKey);
  const pick = <T,>(arr: readonly T[], shift: number): T => arr[(h >>> shift) % arr.length]!;
  return { skin: pick(SKINS, 0), top: pick(TOPS, 4), hair: pick(HAIRS, 8), hairColor: pick(HAIR_COLORS, 12), hat: pick(HATS, 16), extra: pick(EXTRAS, 20) };
}

// Adapter for the PROVISIONAL protocol appearance `{ color, hat }` until the schema swap.
// Missing fields are filled deterministically from the seat id (stable across reconnects, not from role).
export function appearanceFromProtocol(p: { color: string; hat: string }, seat: string): SceneAppearance {
  const base = randomAppearance(seat);
  const top = (TOPS as readonly string[]).includes(p.color) ? (p.color as SceneAppearance['top']) : base.top;
  const hat: SceneAppearance['hat'] = (HATS as readonly string[]).includes(p.hat) ? p.hat : 'none';
  return { ...base, top, hat };
}
