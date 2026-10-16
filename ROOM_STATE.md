# Moonveil room state

Maintained by Lead (93ca0cd6-c546-456f-b97f-c3c9c4115a14). Peers: read, don't edit. Authoritative product decisions: PROJECT_BRIEF.md.

## Git
- Commit/push/PR allowed. ANY merge (incl. ff of scope branch into `dev` or `main`) and any deployment need explicit Human approval. No cherry-pick/other workaround.
- `dev` = init commit acf85a0 (docs). Scope work: commit + push on own branch `<scope>` in `.worktrees/<scope>`; rebasing own branch onto dev is fine.
- Integration into `dev`: held. Lead brings a concrete integration proposal or a scoped standing-permission request to Human.
- Main checkout stays clean; only Lead commits ROOM_STATE.md there.

## Owners (one per changing scope)
| Scope | Owner agent | Paths | Ports |
|---|---|---|---|
| foundation: init, root tooling, server, web shell, protocol, e2e harness | 46b279f0 | root config, apps/*, packages/protocol, e2e/, docs/architecture | 4100–4199 |
| rules: proposal + pure engine | fd99d2a9 | packages/rules, docs/rules | — |
| visual preview | d9e8c62b | preview/, docs/visual | 4200–4299 |
| voice investigation | 87bbae25 | spikes/voice, docs/voice | 4300–4399 |

## Milestones
- M0 init: docs committed on `dev` (acf85a0). [done]
- M1 visual preview → Human approval before broad visual production. [in progress]
- M1 rule proposal → Human gameplay decisions. [in progress]
- M1 voice recommendation (provider/cost) → Human cost decision if non-zero. [in progress]
- M2 playable vertical slice: full automatic + moderator match, server-side isolation, reconnect, 7–10 browser sessions. [blocked on M1 rules decisions for final rules; engine uses provisional defaults]
- M3 production visuals/audio/animation/UI (after preview approval) + voice integration.
- M4 acceptance: full matches both modes, isolation, ghosts, reconnect, phone/laptop emulation; exact revision + limits reported; merge/deploy request.

## Decisions (Lead, technical, open to challenge)
- Current design: TypeScript end to end, server-authoritative; clients receive only seat-entitled info.
- Voice permissions enforced server-side; provider undecided (LiveKit candidate only).
- Unresolved gameplay may be explored only as clearly provisional, isolated prototypes; never accepted production rules without Human approval.

## Pending Human decisions
- Standing permission to ff-merge scope branches into `dev` (not main) after owner checks + Lead diff review? [raised to Supervisor]
- Coming: rules proposal, preview approval, voice provider/cost.

## Acceptance evidence
- (none yet)
