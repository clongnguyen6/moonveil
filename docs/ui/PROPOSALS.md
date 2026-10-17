# Game UI → foundation / rules: requested changes

Concrete, smallest-useful. Each item says what the UI does meanwhile.

## P1. Moderator route — DONE in foundation-3 (moderator sends `act` with a rules Command → `engine.moderate`). UI uses it.

## P2. Text chat — DONE in foundation-3 (`say`, `chat`, `chatlog` by listen grant). UI uses the protocol `ChatMessage`.
Client side DONE in foundation-4 (`ClientState.chat/speaking/voiceMode/serverOffsetMs`, `client.onPoses`). Earlier text: Request: either
(a) `ClientState` gains `chat: Record<channel, ChatMessage[]>` and `speaking: SeatId[]` maintained from those frames (chatlog replaces, chat appends, channel removed when its listen grant goes), or
(b) a `client.onFrame(fn)` listener so the UI adapter keeps that state itself.
Meanwhile the UI adapter (`src/game/client-session.ts`) taps the socket's message events; labelled interim.

## P3. Voice mode flag — DONE in foundation-4 (`SeatView.voiceMode`, `create.voiceMode`). UI: in-person checkbox at creation; mic hidden, text kept.
`SeatView.voiceMode: 'remote' | 'inPerson'` (room setting at creation, creator's choice). UI: hides the mic, shows "voice off, talk at the table", keeps chat. Voice scope: issue no tokens when `inPerson` (RECOMMENDATION.md §6).
Meanwhile: `SessionState.voiceMode` defaults to `remote`.

## P4. Speaking indicators — DONE on the wire in foundation-3 (`speaking` frame). Client-side state: see P2.

## P5. Phase duration — DONE in foundation-4 (`phaseDurationMs` + server `now`); the timer ring uses the server clock.
`SeatView.phaseStartedAt: number | null` next to `phaseEndsAt`, so the timer ring is exact after reconnect. Meanwhile the ring starts from the moment the deadline was first seen; the number is always exact.

## P6. Moderator enters the Yes count (rules) — DONE in dev 58abc9e
`day.confirmCount { yes }`; `confirm` log entry has `counted: 'moderator'`. UI sends it from `src/game/commands.ts`.

## P7. Ballots out of the projection (rules) — DONE in dev 58abc9e
Players get `votes: null` mid-vote and `me.ballot`; UI reads `me.ballot` only. Still open (provisional, rules): `moderator.seesLiveBallots` and `day.showWhoVoted`. The UI never renders `votes`/`voted`, so either decision needs no UI change.

## P8. Workspace + typing (foundation) — DONE (rules + scene declared in apps/web)
- `packages/rules` is in root `workspaces` on dev (done). `apps/web/package.json` still needs `"@moonveil/rules": "*"` so the dependency is declared, not just hoisted.
- `SeatView.game` typed as `HostView | null` once wired (INTEGRATION.md item 3).

## P9. Shell handoff (foundation → game-ui)
When `App.tsx`/`main.tsx` are handed over: `App` becomes `<GameApp session={clientAdapter} />` where `clientAdapter` wraps `Client` (`src/client.ts`, foundation) into `src/game/session.ts` `Session` (same `subscribe/getState/send`, plus `chat/speaking/voiceMode` from P2–P4). `styles.css` → replaced by `ui/layout.css` import. `provisional/FixtureGame.tsx` → deleted once the server runs the rules engine.

## P10. Traffic side channel (foundation, later)
Night actions produce frames only from acting seats. Option: clients send a `noop` act at a fixed cadence during secret steps so wire activity is uniform. Not built; ADR 0001 accepts this risk for now.

## Rules questions (for the rules owner)
- `day.openVotes`, `day.accusedVotesOnConfirm`, `reveal.historyAtEnd`: UI follows the projection; no change needed if they flip.
- Help text needs public rule settings to describe the match truthfully (e.g. Guard repeat rule, Seer result kind, timers). Request a public `rules` summary in the projection (`{ seer.result, guard.noRepeatTarget, witch.*, timing.* }`) so help copy reads settings instead of hard-coding them. Until then help lists only approved rules + "other details follow the match settings".

## P11. `@moonveil/scene` in the web manifest — DONE in foundation-4
`apps/web/package.json` needs `"@moonveil/scene": "*"` (the shell imports it for the mount; resolves today only by hoisting).

## P12. Deck preview + host customization in the lobby (foundation + rules)
Batch A: decks are engine config and host customization is engine-validated. The lobby has no deck data before start (`SeatView` carries only `limits`). Request: `SeatView.deck: { default: Record<Role, number>; custom: Record<Role, number> | null }` for the current player count, and a host message `{ t: 'deck', counts }` validated by `validateDeck()` (error → `invalid-action`). UI then shows the deck in the lobby and a host editor; until then only the dealt deck (`roleCounts`) is shown after start.

## P13. Stalemate + moderator end (rules-12) — names the UI reads (`src/game/approved.ts`, one place)
- Public event `{ t: 'stalemateWarning', day }` published at the end of a day after 2 consecutive no-death cycles; the UI shows the banner until a death/execution/shot or the end.
- `Outcome.reason = 'stalemate'` (winner `'draw'`) for the three-cycle draw.
- Moderator end: the UI sends `match.end { confirm: 'end-match' }` (rules-12 5def39a) and renders reason `'aborted'` as "The moderator ended the match. No winner."

## P14. Scene keyboard handler vs text fields (visual, `packages/scene/src/input.ts:16`)
`window.addEventListener('keydown')` calls `preventDefault()` on Space for every target, and WASD/arrows walk the avatar while a player types in chat or the end-match box. Request: ignore events whose target is editable (`input`, `textarea`, `isContentEditable`) or inside `[data-ui]`, like the pointer handler already does (line 27). DONE in visual-5 (3400f92): the scene ignores editable targets and `[data-ui]` and never claims Escape. The shell's interim key guard was removed.

## P15. Expose the close code for the reconnect overlay — DONE in dev 36bdafd (`ClientState.lastCloseCode`); the adapter reads it directly.
Server restarts close sockets with 1012 (SIGTERM) and the match is paused and restored; a local drop keeps timers running. Request: `ClientState.lastCloseCode: number | null` (the last `onclose` code while `status === 'reconnecting'`). The UI adapter already maps `lastCloseCode === 1012` to `SessionState.serverRestart`, which switches the overlay copy to "Your match is saved and paused until the server is back." Until then the overlay shows the neutral "Your seat and progress are saved."

## P16. Explicit voice join — DONE in foundation-10 (`client.joinVoice/leaveVoice`, `ClientState.voiceJoined`)
`client.joinVoice(): Promise<void>` (connect the already-received sessions, acquire the mic), `client.leaveVoice(): Promise<void>` (disconnect, release the mic), `ClientState.voiceJoined: boolean`. Until these exist the UI's Join voice button is a no-op on the real client (stub implements it).

## P17. Host switches voice mode in the lobby — DONE in foundation-10 (`{ t: 'voiceMode' }`)
C→S `{ t: 'voiceMode', ref?, voiceMode: 'remote' | 'inPerson' }`, host only, lobby only; `SeatView.voiceMode` updates for everyone; remote → inPerson revokes voice sessions for all seats.

## P18. e2e asserts on error codes, not copy (foundation, `e2e/tests/lobby.spec.ts:43`)
Error text is localized player copy now (D4). `[data-testid=error]` carries `data-code=<ErrorCode>`; please assert `toHaveAttribute('data-code', 'room-not-found')` (and `name-taken` on line ~14) instead of substrings. The English line keeps "no such room" for now so the current spec stays green.

## P19. Server-side voice availability — DONE in foundation-15 (`SeatView.voiceAvailable`); the stub sets it so it can become required.
`SeatView.voiceAvailable: boolean` — false when the server runs with voice off (no LiveKit backend) so the UI offers no Join voice and says "Voice is off on this server; play with text chat." Until it exists the UI relies on the bounded wait: joined with no session or no connected channel for 30 s → "Voice unavailable right now. Text chat still works." with a retry. The UI already reads the field when present.
