// PROPOSAL (ADR 0011), not wired in yet: nothing imports this module; the wire still uses Appearance {color, hat}.
// Shape, validation and persistence: foundation. Catalog CONTENT (ids, which outfit allows what): art-themes owner;
// every id below is a placeholder. Cosmetic only: chosen by the player in the lobby, never derived from a role.

// --- catalog (content: art-themes owner; shape: foundation) ---

// Global id lists. A future outfit adds ids here and one entry in OUTFITS; the schema doesn't change.
export const COLORS = ['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate', 'clay', 'sky', 'bark', 'rose'] as const;
export const HATS = [
  'none', 'beanie', 'cap', 'bucket', 'flower', 'hood', // today's camper hats (wire ids unchanged)
  'catHood', 'robotHood', 'pufferHat', 'sharkHat', 'frogHat', 'duckCap', 'mushroomCap',
] as const;
export const ACCESSORIES = [
  'none', 'scarf', 'backpack', // today's scene extras
  'fishSling', 'utilityPocket', 'raincoatPockets', 'leafPack', 'woodPack',
] as const;
export const SKINS = ['fair', 'light', 'tan', 'brown', 'deep'] as const;
export const HAIRS = ['short', 'long', 'bun', 'curly', 'bald'] as const;
export const HAIR_COLORS = ['black', 'brown', 'chestnut', 'blond', 'ink', 'red'] as const;

export type ColorId = (typeof COLORS)[number];
export type HatId = (typeof HATS)[number];
export type AccessoryId = (typeof ACCESSORIES)[number];

// One outfit = a whole look on the camper body. Fixed pieces (cat ears, ring halves, fins) belong to the
// variant and are drawn by the scene from (outfit, variant); the lists below are what the player may choose.
// First entry of each list = default. A list of one = not customisable for that outfit.
export interface OutfitDef {
  readonly variants: readonly string[];
  readonly colors: readonly ColorId[];
  readonly hats: readonly HatId[];
  readonly fronts: readonly AccessoryId[];
  readonly backs: readonly AccessoryId[];
}

const ALL_COLORS = COLORS;
export const OUTFITS = {
  camper: { variants: ['default'], colors: ALL_COLORS, hats: ['none', 'beanie', 'cap', 'bucket', 'flower', 'hood'], fronts: ['none', 'scarf'], backs: ['none', 'backpack'] },
  bowCat: { variants: ['default'], colors: ['rose', 'berry', 'river', 'sand'], hats: ['catHood'], fronts: ['fishSling', 'none'], backs: ['none'] },
  robotCat: { variants: ['default'], colors: ['river', 'slate', 'sky'], hats: ['robotHood'], fronts: ['utilityPocket', 'none'], backs: ['none'] },
  fish: { variants: ['puffer', 'shark'], colors: ['clay', 'sand', 'sky'], hats: ['pufferHat', 'sharkHat'], fronts: ['none'], backs: ['none'] },
  frog: { variants: ['default'], colors: ['pine', 'moss'], hats: ['frogHat'], fronts: ['raincoatPockets', 'none'], backs: ['leafPack', 'none'] },
  duck: { variants: ['ring', 'plain'], colors: ['sand', 'clay'], hats: ['duckCap'], fronts: ['none'], backs: ['none'] },
  mushroom: { variants: ['default'], colors: ['bark', 'clay', 'ember'], hats: ['mushroomCap'], fronts: ['scarf', 'none'], backs: ['woodPack', 'none'] },
} as const satisfies Record<string, OutfitDef>;
export type OutfitId = keyof typeof OUTFITS;

// --- wire / stored shape (foundation) ---

// Canonical form: what the server stores, persists and sends in every SeatView. Always complete.
// `color` and `hat` keep today's names so pages still running an older bundle degrade instead of breaking.
export interface AppearanceV2 {
  outfit: OutfitId;
  variant: string; // one of OUTFITS[outfit].variants
  color: ColorId; // one of OUTFITS[outfit].colors
  hat: HatId; // one of OUTFITS[outfit].hats
  front: AccessoryId; // one of OUTFITS[outfit].fronts
  back: AccessoryId; // one of OUTFITS[outfit].backs
  // Absent = seat-seeded skin/hair, as today (stable per seat, never from a role). Present = player's choice.
  body?: { skin: (typeof SKINS)[number]; hair: (typeof HAIRS)[number]; hairColor: (typeof HAIR_COLORS)[number] };
}

// What a client may send in `profile`: the canonical form with omitted fields filled from the outfit's defaults,
// or today's legacy {color, hat} (pages on an older bundle during a deploy), upgraded to the camper outfit.
export type AppearanceInput = (Partial<Omit<AppearanceV2, 'outfit'>> & { outfit: OutfitId }) | { color: string; hat: string };

// Planned (not implemented in this proposal):
//   normalizeAppearance(input, seat): AppearanceV2 | { error: string }   // validate ids + per-outfit lists, fill defaults
//   upgradeLegacy({color, hat}, seat): AppearanceV2                      // camper; restore and legacy input
