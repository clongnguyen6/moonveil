// Look (costume) helpers for the picker. PURE. Every list comes from the catalog (`OUTFITS`, protocol/appearance.ts):
// a new outfit, variant or option appears in the picker with no change here. Cosmetic only: never reads a role.
import {
  type AppearanceInput,
  type CostumeAppearance,
  isLegacyAppearance,
  normalizeCostume,
  OUTFITS,
  type OutfitDef,
  type OutfitId,
  upgradeLegacy,
} from '@moonveil/protocol';
import { seededExtras } from '@moonveil/scene/seed';

export type Look = CostumeAppearance;
/** Name + canonical look: what the editor drafts and sends. */
export interface LookProfile { name: string; appearance: Look }

export const outfitIds = (): OutfitId[] => Object.keys(OUTFITS) as OutfitId[];
export const outfitDef = (id: string): OutfitDef | null => (Object.hasOwn(OUTFITS, id) ? OUTFITS[id as OutfitId] : null);

/** Same rule as the server (apps/server/src/appearance.ts): legacy {color, hat} → camper with the seat-seeded
 *  front/back; costume input → canonical, or the refusal reason. */
export function resolveLook(input: AppearanceInput, seat: string): { ok: true; value: Look } | { ok: false; error: string } {
  return isLegacyAppearance(input) ? upgradeLegacy(input, seededExtras(seat)) : normalizeCostume(input);
}

/** Any appearance as shown in a SeatView (canonical, or legacy from an old server) → canonical look for the editor.
 *  Opens on the player's real look, never on defaults (old editor reset non-legacy colours/hats). */
export function lookOf(a: CostumeAppearance | { color: string; hat: string }, seat: string): Look {
  const r = resolveLook(a as AppearanceInput, seat);
  return r.ok ? r.value : (normalizeCostume({ outfit: 'camper' }) as { ok: true; value: Look }).value;
}

/** Switch outfit: the new outfit's defaults, keeping the colour when the new outfit offers it. */
export function withOutfit(cur: Look, outfit: OutfitId): Look {
  const d = OUTFITS[outfit];
  const keep = (d.colors as readonly string[]).includes(cur.color);
  const r = normalizeCostume({ outfit, ...(keep ? { color: cur.color } : {}) });
  return r.ok ? { ...r.value, ...(cur.body ? { body: cur.body } : {}) } : cur;
}

export const sameLook = (a: Partial<Look> & { color: string; hat: string }, b: Partial<Look> & { color: string; hat: string }) =>
  a.outfit === b.outfit && a.variant === b.variant && a.color === b.color && a.hat === b.hat && a.front === b.front && a.back === b.back;

/** Fields the player can change for this outfit (catalog lists with more than one entry). */
export function choices(outfit: OutfitId): { variants: readonly string[]; colors: readonly string[]; hats: readonly string[]; fronts: readonly string[]; backs: readonly string[] } {
  const d: OutfitDef = OUTFITS[outfit];
  const many = <T,>(xs: readonly T[]) => (xs.length > 1 ? xs : []);
  return { variants: many(d.variants), colors: many(d.colors), hats: many(d.hats), fronts: many(d.fronts), backs: many(d.backs) };
}

/** Readable fallback for an id without a translated name (a future catalog entry): "fishSling" → "Fish sling". */
export const humanize = (id: string) => id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`);
