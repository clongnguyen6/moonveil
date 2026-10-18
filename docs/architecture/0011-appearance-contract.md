# 0011: Appearance contract for costumes

Status: proposal, 2026-10-18. Foundation owns the shape, validation and persistence. The art-themes owner owns the catalog content; every id in `packages/protocol/src/appearance-v2.ts` is a placeholder. The scene and the picker UI consume the contract. Nothing is wired in yet: the wire still carries `{color, hat}`, and live stays `3b1dbde`.

## Shape
- **One outfit, then customise.** `AppearanceV2 = { outfit, variant, color, hat, front, back, body? }`.
  - `outfit`: a whole look on the unchanged camper body (`camper` = today's look, `bowCat`, `robotCat`, `fish`, `frog`, `duck`, `mushroom`).
  - `variant`: fixed pieces the scene draws from (outfit, variant), for example `fish: puffer | shark` and `duck: ring | plain`. A ring split behind and in front of the torso is a variant, not two accessories.
  - `color`, `hat`, `front`, `back`: the player's choices. Each must be in that outfit's catalog list; the first entry is the default, and a list of one means not customisable.
  - `front` and `back` replace the single `extra`, so the mushroom's scarf + pack and the frog's pockets + leaf pack fit.
  - `body`: absent means seat-seeded skin and hair, exactly as today. Present means the player's choice (if the UI offers it later).
- **Growth = catalog addition.** A new outfit or variant adds ids to the global lists and one `OUTFITS` entry. The wire shape, the validation code and persistence don't change.
- **Old clients degrade.** `color` and `hat` keep today's field names. A page on an older bundle maps unknown ids to its defaults instead of failing.

## Validation (server, next step)
- `profile.appearance` accepts `AppearanceInput`: the canonical form with omitted fields filled from the outfit's defaults, or legacy `{color, hat}`, upgraded to `camper` for pages on an old bundle during a deploy.
- Unknown ids, or a choice not in that outfit's list, are refused. Proposed: a new error code `invalid-appearance`, so the UI can show it; today's `bad-message` is the fallback.
- The server stores and broadcasts only the canonical, complete form.
- **Cosmetic only:**
  - set by the player, and only in the lobby (the existing `profile` lock during play);
  - defaults come from the catalog, and the body seed from the seat id;
  - nothing reads the rules engine or a role.
  - Planned test: identical appearances across different role deals.

## Persistence and old saved rooms
- **No STATE_VERSION change.** Appearance isn't in the rules engine's state: `packages/rules/src` has no appearance field (grep, 2026-10-18). It lives only in the server's room seats (`apps/server/src/room.ts` seats and the room snapshot).
- **Room snapshots keep `v: 1` with a tolerant reader.** On restore, a seat whose appearance is legacy `{color, hat}` is upgraded with `upgradeLegacy`:
  - `outfit: camper`, `variant: default`;
  - `color` and `hat` unchanged: all 8 legacy colours and 6 legacy hats are already ids in the new lists;
  - `body` absent, so seat-seeded as today.
- **Planned evidence:** a restore test from real snapshots saved by `3b1dbde`, lobby and in progress, plus a render-equivalence test showing the scene draws the upgraded seat exactly as it drew the legacy one.
- **Rollback to `3b1dbde`:** its restore copies seats as they are, so new-shape appearances reach old clients, which keep `color` and `hat` and map unknown ids to defaults. A new client's `profile` message would be refused by the old server until the next deploy. Acceptable; to be stated in the deploy request.

## Questions for reviewers
1. **Scene:** today the scene seeds `extra` (scarf, backpack) from the seat. Should `upgradeLegacy` set `front`/`back` from that same seed, so restored campers look identical (the server would use `@moonveil/scene`'s pure seed function)? Or is dropping the seeded extra on upgrade acceptable?
2. **UI:** is `invalid-appearance` with the offending field useful, or is a whole-profile refusal enough? Is `body` (skin and hair) a picker option for this round?
3. **Art:**
   - fill in the ids and per-outfit lists, including the shark and the duck with and without its ring;
   - say whether any outfit needs a fourth choosable slot. Only that would change the shape.

## Decisions so far (Lead, 2026-10-18; the UI owner may challenge them)
- **Refusal:** a whole-profile refusal with `invalid-appearance` (the picker only offers valid options).
- **`body`:** not a picker option this round. It stays optional and seat-seeded.
- **Open (art owner): the fish mismatch.** The variant (`puffer`/`shark`) and the hat list (`pufferHat`/`sharkHat`) both carry the choice, so mismatched combinations are possible. Two ways out:
  - one of them carries the choice (for example the variant only, with a single fixed headgear per variant);
  - or a small shape extension: per-variant overrides of the outfit's lists, e.g. `variants: { puffer: { hats: ['pufferHat'] }, shark: { hats: ['sharkHat'] } }`. Validation would read the variant's list first.

  Either stays a catalog-level change. The extension is a shape change, so it's foundation's if chosen.

## Implementation (foundation-appearance, 2026-10-18)
- **Catalog:** transcribed exactly from `docs/visual/themes/CATALOG.md` (art-themes `3776e4d`), in `packages/protocol/src/appearance.ts`.
  - The fish choice lives only in `variant` (`puffer` / `shark`); `fishHeadgear` or `none` is the hat.
  - New back item `finPouch`. `none` comes after every costume headgear. No fourth slot.
- **Validation:**
  - `ProfileInput` accepts the costume form or legacy `{color, hat}` (structure only). `normalizeCostume` fills the outfit's defaults, or refuses.
  - The server (`apps/server/src/appearance.ts`) turns a refusal into a whole-profile `invalid-appearance`. Nothing changes on refusal, and a refused join leaves no seat.
- **Legacy upgrade:** camper, same colour and hat, `front`/`back` from `@moonveil/scene/seed` `seededExtras(seat)`, `body` absent. It applies to both legacy input and restored seats. Restored canonical seats are re-validated against the current catalog; an unreadable one falls back to the seeded camper (`room <CODE> appearance-reset seats=N`).
- **STATE_VERSION:** unchanged (2). Room snapshots keep `v: 1`.
- **Evidence:** `apps/server/test/appearance.test.ts`, with real 3b1dbde snapshots in `apps/server/test/fixtures/rooms-3b1dbde/`, written by running 3b1dbde's own server code:
  - every catalog combination valid;
  - unknown and mismatched input refused;
  - legacy input accepted;
  - lobby and mid-match snapshots restore, and each seat equals what the scene's legacy adapter drew;
  - looks identical across two role deals, for every viewer;
  - the look is locked during play.
- **Wire type:** `PublicSeat.appearance: CostumeAppearance | Appearance`. Servers send the canonical form; the legacy pair stays in the type for stubs and older servers. Both forms carry `color` and `hat`, and `legacyLook()` gives the `{color, hat}` view for code still on the legacy picker.

