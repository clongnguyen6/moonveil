# 0011: Appearance contract for costumes (PROPOSAL, for review)

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
