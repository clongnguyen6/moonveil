// Appearance on the server (ADR 0011): every seat stores the canonical CostumeAppearance. Input is normalized or
// refused (`invalid-appearance`, whole profile); legacy {color, hat} becomes the camper outfit with the seat-seeded
// front/back the scene drew before (@moonveil/scene/seed), so nothing changes visibly. Only the seat id and the
// player's own input are read: never the rules engine, never a role.
import { type AppearanceInput, type CostumeAppearance, isLegacyAppearance, normalizeCostume, upgradeLegacy } from '@moonveil/protocol';
import { seededExtras } from '@moonveil/scene/seed';

export class AppearanceError extends Error {}

export function resolveAppearance(input: AppearanceInput, seat: string): CostumeAppearance {
  const r = isLegacyAppearance(input) ? upgradeLegacy(input, seededExtras(seat)) : normalizeCostume(input);
  if (!r.ok) throw new AppearanceError(r.error);
  return r.value;
}

// A stored seat's appearance on restore: legacy (saved by servers up to 3b1dbde) is upgraded; canonical is
// re-validated against the current catalog; anything unreadable falls back to the seeded default camper.
export function restoredAppearance(stored: unknown, seat: string): { value: CostumeAppearance; reset: boolean } {
  const a = stored as Record<string, unknown> | null;
  const asInput =
    a && typeof a === 'object' && typeof a.outfit === 'string'
      ? (a as AppearanceInput)
      : a && typeof a === 'object' && typeof a.color === 'string' && typeof a.hat === 'string'
        ? { color: a.color, hat: a.hat }
        : null;
  if (asInput) {
    try {
      return { value: resolveAppearance(asInput, seat), reset: false };
    } catch {
      /* fall through */
    }
  }
  return { value: resolveAppearance({ color: 'moss', hat: 'none' }, seat), reset: true };
}
