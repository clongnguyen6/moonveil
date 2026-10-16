# Game UI → foundation / rules: requested changes

Concrete, smallest-useful. Each item says what the UI does meanwhile.

## P1. Moderator route (foundation, protocol + server) — needed for the console
`ClientMessage` += `{ t: 'moderate', ref?, action: unknown }` → `engine.moderate(state, action)`; moderator seat only; `invalid-action` on engine error.
Also route the moderator's existing `advance` through `moderate({type:'step.close'})` or keep both. UI sends `moderate` for: `step.close`, `player.remove`, `match.abort`, and the approved Yes-count entry (P6).
Meanwhile: stub implements it; real client would get `bad-message`.

## P2. Text chat (foundation, protocol + server) — approved channel policy applies to text
- C→S `{ t: 'chat', ref?, channel: 'public'|'wolves'|'ghosts', text: string(≤500) }`. Accept only if `engine.channels(state, seat)` has `speak` for that channel (lobby/ended: public). Reject silently (ack only) otherwise.
- S→C `{ t: 'chat', msg: { id, channel, from: { seat: SeatId|null, name }, text, at } }` live, delivered only to seats whose *current* grant has `listen`.
- History: `{ t: 'chatHistory', msgs: [...] }` on attach/resume, filtered by the grant **at read time** (rules API: a pending Hunter who reconnects gets no ghost history).
- Not a snapshot field: chat is append-only and would bloat `state` diffs.
Meanwhile: `SessionState.chat` is filled by the stub; UI shows tabs only for channels with `listen`.

## P3. Voice mode flag (foundation, protocol) — in-person play
`SeatView.voiceMode: 'remote' | 'inPerson'` (room setting at creation, creator's choice). UI: hides the mic, shows "voice off, talk at the table", keeps chat. Voice scope: issue no tokens when `inPerson` (RECOMMENDATION.md §6).
Meanwhile: `SessionState.voiceMode` defaults to `remote`.

## P4. Speaking indicators (foundation + voice; already in INTEGRATION.md)
`{ t: 'speaking', seats: SeatId[] }` ≤ 5 Hz, filtered per viewer to channels it may listen to. UI draws rings on seat chips from `SessionState.speaking`.

## P5. Phase start time (foundation, protocol) — nice to have
`SeatView.phaseStartedAt: number | null` next to `phaseEndsAt`, so the timer ring is exact after reconnect. Meanwhile the ring starts from the moment the deadline was first seen; the number is always exact.

## P6. Moderator enters the Yes count (rules) — DONE in dev 58abc9e
`day.confirmCount { yes }`; `confirm` log entry has `counted: 'moderator'`. UI sends it from `src/game/commands.ts`.

## P7. Ballots out of the projection (rules) — DONE in dev 58abc9e
Players get `votes: null` mid-vote and `me.ballot`; UI reads `me.ballot` only. Still open (provisional, rules): `moderator.seesLiveBallots` and `day.showWhoVoted`. The UI never renders `votes`/`voted`, so either decision needs no UI change.

## P8. Workspace + typing (foundation)
- `packages/rules` is in root `workspaces` on dev (done). `apps/web/package.json` still needs `"@moonveil/rules": "*"` so the dependency is declared, not just hoisted.
- `SeatView.game` typed as `HostView | null` once wired (INTEGRATION.md item 3).

## P9. Shell handoff (foundation → game-ui)
When `App.tsx`/`main.tsx` are handed over: `App` becomes `<GameApp session={clientAdapter} />` where `clientAdapter` wraps `Client` (`src/client.ts`, foundation) into `src/game/session.ts` `Session` (same `subscribe/getState/send`, plus `chat/speaking/voiceMode` from P2–P4). `styles.css` → replaced by `ui/layout.css` import. `provisional/FixtureGame.tsx` → deleted once the server runs the rules engine.

## P10. Traffic side channel (foundation, later)
Night actions produce frames only from acting seats. Option: clients send a `noop` act at a fixed cadence during secret steps so wire activity is uniform. Not built; ADR 0001 accepts this risk for now.

## Rules questions (for the rules owner)
- `day.openVotes`, `day.accusedVotesOnConfirm`, `reveal.historyAtEnd`: UI follows the projection; no change needed if they flip.
- Help text needs public rule settings to describe the match truthfully (e.g. Guard repeat rule, Seer result kind, timers). Request a public `rules` summary in the projection (`{ seer.result, guard.noRepeatTarget, witch.*, timing.* }`) so help copy reads settings instead of hard-coding them. Until then help lists only approved rules + "other details follow the match settings".
