// Appearance contract (ADR 0011). Shape, validation and persistence: foundation. Catalog CONTENT: art-themes owner,
// transcribed from docs/visual/themes/CATALOG.md (art-themes 3776e4d). Cosmetic only: chosen by the player in the
// lobby, never derived from a role. A future outfit or variant = new ids + one OUTFITS entry; nothing else changes.
import { z } from 'zod';

// --- catalog ---
export const COLORS = ['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate', 'clay', 'sky', 'bark', 'rose'] as const;
export const HATS = ['none', 'beanie', 'cap', 'bucket', 'flower', 'hood', 'catHood', 'robotHood', 'fishHeadgear', 'frogHat', 'duckCap', 'mushroomCap'] as const;
export const ACCESSORIES = ['none', 'scarf', 'backpack', 'fishSling', 'utilityPocket', 'raincoatPockets', 'leafPack', 'woodPack', 'finPouch'] as const;
export const SKINS = ['fair', 'light', 'tan', 'brown', 'deep'] as const;
export const HAIRS = ['short', 'long', 'bun', 'curly', 'bald'] as const;
export const HAIR_COLORS = ['black', 'brown', 'chestnut', 'blond', 'ink', 'red'] as const;

export type ColorId = (typeof COLORS)[number];
export type HatId = (typeof HATS)[number];
export type AccessoryId = (typeof ACCESSORIES)[number];

// First entry of each list = default; a list of one = not choosable. Fixed pieces (duck ring halves, fins, ears)
// belong to (outfit, variant) and are drawn by the scene.
export interface OutfitDef {
  readonly variants: readonly string[];
  readonly colors: readonly ColorId[];
  readonly hats: readonly HatId[];
  readonly fronts: readonly AccessoryId[];
  readonly backs: readonly AccessoryId[];
}
export const OUTFITS = {
  camper: { variants: ['default'], colors: ['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate', 'clay', 'sky', 'bark', 'rose'], hats: ['none', 'beanie', 'cap', 'bucket', 'flower', 'hood'], fronts: ['none', 'scarf'], backs: ['none', 'backpack'] },
  bowCat: { variants: ['default'], colors: ['rose', 'berry'], hats: ['catHood', 'none'], fronts: ['fishSling', 'none'], backs: ['none'] },
  robotCat: { variants: ['default'], colors: ['river', 'slate'], hats: ['robotHood', 'none'], fronts: ['utilityPocket', 'none'], backs: ['none'] },
  fish: { variants: ['puffer', 'shark'], colors: ['clay', 'sand', 'slate', 'river'], hats: ['fishHeadgear', 'none'], fronts: ['none'], backs: ['none', 'finPouch'] },
  frog: { variants: ['default'], colors: ['pine', 'moss'], hats: ['frogHat', 'none'], fronts: ['raincoatPockets', 'none'], backs: ['leafPack', 'none'] },
  duck: { variants: ['ring', 'plain'], colors: ['sand', 'clay'], hats: ['duckCap', 'none'], fronts: ['none'], backs: ['none'] },
  mushroom: { variants: ['default'], colors: ['bark', 'pine'], hats: ['mushroomCap', 'none'], fronts: ['scarf', 'none'], backs: ['woodPack', 'none'] },
} as const satisfies Record<string, OutfitDef>;
export type OutfitId = keyof typeof OUTFITS;
export const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];

// --- canonical form: stored, persisted, sent in every SeatView; always complete ---
export interface Body {
  skin: (typeof SKINS)[number];
  hair: (typeof HAIRS)[number];
  hairColor: (typeof HAIR_COLORS)[number];
}
export interface CostumeAppearance {
  outfit: OutfitId;
  variant: string;
  color: ColorId;
  hat: HatId;
  front: AccessoryId;
  back: AccessoryId;
  // Absent = seat-seeded skin/hair (scene), as before; not a player choice this round.
  body?: Body;
}

// --- input (client `profile`): costume form (omitted fields = the outfit's defaults) or legacy {color, hat} ---
const Id = z.string().min(1).max(32);
export const LegacyAppearanceInput = z.strictObject({ color: Id, hat: Id });
export const CostumeAppearanceInput = z.strictObject({
  outfit: Id,
  variant: Id.optional(),
  color: Id.optional(),
  hat: Id.optional(),
  front: Id.optional(),
  back: Id.optional(),
  body: z.strictObject({ skin: Id, hair: Id, hairColor: Id }).optional(),
});
// Structure only (strings, known keys): unknown ids or a choice outside the outfit's lists are refused semantically
// by normalizeCostume (error `invalid-appearance`), not as a malformed message.
export const AppearanceInput = z.union([CostumeAppearanceInput, LegacyAppearanceInput]);
export type AppearanceInput = z.infer<typeof AppearanceInput>;

export const isLegacyAppearance = (a: AppearanceInput): a is z.infer<typeof LegacyAppearanceInput> => !('outfit' in a);

const has = <T extends string>(list: readonly T[], v: string | undefined): v is T => v !== undefined && (list as readonly string[]).includes(v);
const isOutfit = (v: string): v is OutfitId => Object.hasOwn(OUTFITS, v);

export type Normalized = { ok: true; value: CostumeAppearance } | { ok: false; error: string };

// Costume input -> canonical, or the reason it is refused. Pure; the only input is the client's own choice.
export function normalizeCostume(a: z.infer<typeof CostumeAppearanceInput>): Normalized {
  if (!isOutfit(a.outfit)) return { ok: false, error: `unknown outfit ${a.outfit}` };
  const o: OutfitDef = OUTFITS[a.outfit];
  const pick = <T extends string>(field: string, list: readonly T[], v: string | undefined): T | string => (v === undefined ? list[0]! : has(list, v) ? v : `${field} ${v} not offered by ${a.outfit}`);
  const variant = pick('variant', o.variants, a.variant);
  const color = pick('color', o.colors, a.color);
  const hat = pick('hat', o.hats, a.hat);
  const front = pick('front', o.fronts, a.front);
  const back = pick('back', o.backs, a.back);
  for (const v of [variant, color, hat, front, back]) if (v.includes(' ')) return { ok: false, error: v };
  const value: CostumeAppearance = { outfit: a.outfit, variant, color: color as ColorId, hat: hat as HatId, front: front as AccessoryId, back: back as AccessoryId };
  if (a.body) {
    const { skin, hair, hairColor } = a.body;
    if (!has(SKINS, skin) || !has(HAIRS, hair) || !has(HAIR_COLORS, hairColor)) return { ok: false, error: 'body not in catalog' };
    value.body = { skin, hair, hairColor };
  }
  return { ok: true, value };
}

// Legacy {color, hat} -> camper, with the seat-seeded front/back the scene drew before (passed in by the server,
// from @moonveil/scene/seed), so a restored or old-bundle camper looks identical.
export function upgradeLegacy(a: { color: string; hat: string }, seeded: { front: 'none' | 'scarf'; back: 'none' | 'backpack' }): Normalized {
  return normalizeCostume({ outfit: 'camper', color: a.color, hat: a.hat, front: seeded.front, back: seeded.back });
}
