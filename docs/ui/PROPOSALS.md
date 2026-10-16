# Game UI → foundation / rules: requested changes

Concrete, smallest-useful. Each item says what the UI does meanwhile.

## P1. Moderator route — DONE in foundation-3 (moderator sends `act` with a rules Command → `engine.moderate`). UI uses it.

## P2. Text chat — DONE in foundation-3 (`say`, `chat`, `chatlog` by listen grant). UI uses the protocol `ChatMessage`.
Still missing on the client side (foundation owns `client.ts`): the `Client` drops `chat`/`chatlog`/`speaking`/`poses` frames. Request: either
(a) `ClientState` gains `chat: Record<channel, ChatMessage[]>` and `speaking: SeatId[]` maintained from those frames (chatlog replaces, chat appends, channel removed when its listen grant goes), or
(b) a `client.onFrame(fn)` listener so the UI adapter keeps that state itself.
Meanwhile the UI adapter (`src/game/client-session.ts`) taps the socket's message events; labelled interim.

## P3. Voice mode flag (foundation, protocol) — in-person play
`SeatView.voiceMode: 'remote' | 'inPerson'` (room setting at creation, creator's choice). UI: hides the mic, shows "voice off, talk at the table", keeps chat. Voice scope: issue no tokens when `inPerson` (RECOMMENDATION.md §6).
Meanwhile: `SessionState.voiceMode` defaults to `remote`.

## P4. Speaking indicators — DONE on the wire in foundation-3 (`speaking` frame). Client-side state: see P2.

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
