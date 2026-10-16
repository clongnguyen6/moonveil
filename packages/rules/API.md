# @moonveil/rules — API (v0.1)

Pure, deterministic TypeScript engine. No IO, timers or network, and no runtime dependencies. The server hosts it.
Rules: `docs/rules/PROPOSAL.md`. Every `config` key is **provisional** until the Human approves it (`PROVISIONAL` maps each key to its proposal item).

## Run
```
cd packages/rules && npm install && npm run check   # typecheck + tests
```
- Needs Node ≥ 22.18; it runs the `.ts` sources directly. `.npmrc` keeps npm's cache inside `.cache/` (the workspace write boundary).
- `exports["."] = ./src/index.ts`. If the server needs JS, add a build when the workspace is wired up (foundation owns that).

## Core calls
```ts
createMatch({ seed, playerCount } | { seed, roles: Role[] } | { seed, playerCount, deck }, config?) -> {ok, state} | {ok:false, error}
apply(state, actor, command) -> {ok:true, state} | {ok:false, error:{code, message}}   // input is never mutated
project(state, viewer) -> Projection        // the ONLY thing to send to a client
stepTiming(state) -> {seconds, earlyCloseReady}   // for the automatic orchestrator
```
- `state` is plain JSON. Persist it as is; replaying the same commands on the same seed gives the same state.
- Actors: `{kind:'seat', seat}`, `{kind:'moderator'}`, `{kind:'system'}`. The server authenticates; the engine authorizes:
  - A seat may only issue its own seat commands.
  - The moderator may issue any command, including acting for any seat (`moderator.mayBreakRules=false`: still validated).
  - `step.close`, `player.remove` and `match.abort` are moderator or system only. `wolf.decide` and `day.setOutcome` are moderator only.
- Errors: `forbidden | wrong_step | bad_seat | bad_target | rule | locked | ended`. Return only the code and message to the caller; never broadcast them.

## Steps (state.step.kind)
`night.main` (wolves `wolf.pick`, seer `seer.inspect`, guard `guard.protect`, [`hunter.pin` in pin mode])
→ `night.witch` (`witch.heal {use}`, `witch.poison {target|'pass'}`; runs whenever the deck has a Witch, alive or dead)
→ [`hunter` (`hunter.shoot`) if a Hunter died] → victory check → `day.discussion` → `day.vote` (`vote.nominate {target|'skip'|null}`)
→ `day.defense` → `day.confirm` (`vote.confirm {choice|null}`) → execution → [`hunter`] → victory check → `night.main` … → `ended`.
Every step advances only on `step.close`. Anything not submitted counts as a pass.

## Orchestration
- **Automatic**: on entering a step, start a timer of `stepTiming(state).seconds`. After every accepted command, if `earlyCloseReady` is true, close the step (with an optional short grace). When the timer fires, send `step.close` as `system`. Night steps never report early-ready by default (Q11), so the length of the night leaks nothing.
- **Moderator**: the moderator sends `step.close` when ready. They may also act for seats, set the pack target (`wolf.decide`), set the day result (`day.setOutcome {execute: seat|null}`), remove players or abort.
- **Disconnects**: the engine has no notion of presence. A disconnected seat simply misses its inputs. `player.remove` (system or moderator) is a death with cause `removed`; victory is checked right after.

## Projection (secrecy contract)
`project(state, {kind:'seat', seat})` contains:
- **Public**: step (live votes if `day.openVotes`), seats alive/dead, death cause masked as `'night'` for night deaths, `publicLog`, role counts.
- **Roles**: own role; the pack for wolves; roles revealed publicly; all roles once ended.
- `me.facts`: this seat's knowledge ledger (Seer results, the Witch's victim, the pack target, own actions). A fact is granted only while the seat is alive, so **ghosts keep but never gain**.
- `me.actions`: legal options now, with targets, produced by dry-running `apply`. Render menus from this list.
- `pack.picks`: live pack picks, only for a living wolf during `night.main`.

`{kind:'public'}` gives public data only (spectators, a host without a seat). `{kind:'moderator'}` adds `moderator: {seats, nightRec, history, knowledge, config}`. At `ended`, everyone gets `reveal.roles` (+ `reveal.history` if `reveal.historyAtEnd`).
Never send `state` itself, and never send a moderator projection to a player seat. Voice, chat and channel permissions are derived by the server from the step and projection (for example, the wolf channel = living wolves at night).

## Known public side channels (by design, see the proposal)
- A `hunter` step and `shot` reveal the Hunter (Q06/Q20).
- `stepTiming` early-close for public steps only.
