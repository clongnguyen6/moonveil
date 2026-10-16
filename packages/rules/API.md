# @moonveil/rules — API (v0.2)

Pure, deterministic TypeScript engine. No IO, timers or network, and no runtime dependencies. The server hosts it.
Rules: `docs/rules/PROPOSAL.md`. **Every `config` key, and so every default behaviour, is provisional** until the Human approves it (`PROVISIONAL` maps each key to its proposal item). Only the six roles, the win conditions and resolve-before-victory are approved.

## Run
```
cd packages/rules && npm install && npm run check   # typecheck (all + src without host types) + tests (~8 s)
```
- Toolchain matches the foundation root: Node ≥ 24.12 (runs the `.ts` sources directly), TypeScript 7.0.2, and the same compiler options as `tsconfig.base.json`. `src` must typecheck with no host types (`tsconfig.src.json`), because the engine uses no Node or DOM globals.
- `exports["."] = ./src/index.ts`. If the server needs JS, add a build when the workspace is wired up (foundation owns that).

## Host contract (final; for the server)
Adopted from foundation's draft `apps/server/src/rules/engine.ts` (branch `foundation` b3d9ece), with additions. The server should import it instead of keeping its own copy:
```ts
import { createRulesEngine } from '@moonveil/rules';
const engine = createRulesEngine({ config?, deck? });   // RulesEngine<HostState>
```
| Member | vs draft | Notes |
|---|---|---|
| `id`, `minPlayers`, `maxPlayers` | same | from `config.players` (Q18) |
| `setup({seats, seed})` | same | seeded role assignment; throws only on an invalid player count/deck |
| `phase(s) -> {name, secret, durationMs, earlyClose, ended}` | **+earlyClose** | `secret` = night steps, always `earlyClose=false` (Q11). By default only the Hunter step reports `earlyClose` (once the shot is in); votes run to their deadline (`timing.publicEarlyClose=false`, Q11/Q22) |
| `submit(s, seatId, action)` | same, `error` +`code` | `action` = Command without `seat` (the engine injects the actor). Strictly parsed |
| `moderate(s, action)` | **new** | any Command with seat indices: act for a seat, `wolf.decide`, `day.setOutcome`, `player.remove`, `match.abort`, `step.close` (Q16) |
| `remove(s, seatId)` | **new** | system/host removal; refused during secret steps (Q26). Pending night effects on a removed seat are void |
| `advance(s)` | same | `step.close` as system |
| `view(s, viewer)` | **+`{kind:'public'}`** | the Projection below, plus `seatIds` (index → SeatId) |
| `channels(s, seatId \| viewer)` | **+moderator viewer** | `[{channel:'public'\|'wolves'\|'ghosts', listen, speak}]`, same shape as `VoiceGrant`; applies to voice and text (Q25). A dead Hunter with a pending shot gets public-listen only. Ghost-chat **history** must be filtered by the grant at read time |

- Seats are **indices** inside the game. `view().seatIds[i]` is the server SeatId. Clients send targets as indices.
- Server changes this implies (foundation scope):
  - route moderator actions to `moderate`;
  - call `channels(s, {kind:'moderator'})` for the moderator instead of hard-coding public;
  - optionally honour `earlyClose`.

## Core calls
```ts
createMatch({ seed, playerCount } | { seed, roles: Role[] } | { seed, playerCount, deck }, config?) -> {ok, state} | {ok:false, error}
apply(state, actor, command) -> {ok:true, state} | {ok:false, error:{code, message}}   // input is never mutated
project(state, viewer) -> Projection        // the ONLY thing to send to a client
check(state, actor, command) -> error|null  // validate without applying (cheap; same rules as apply)
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
- **Automatic**: on entering a step, start a timer of `stepTiming(state).seconds`. After every accepted command, if `earlyCloseReady` is true, you may close the step. When the timer fires, send `step.close` as `system`. Night steps never report early-ready (Q11), so the engine adds no timing signal. Server timers, moderator pacing and traffic are outside these tests.
- **Moderator**: the moderator sends `step.close` when ready. They may also act for seats, set the pack target (`wolf.decide`), set the day result (`day.setOutcome {execute: seat|null}`), remove players or abort.
- **Disconnects** (Q26): the engine has no notion of presence. A disconnected seat simply misses its inputs, which count as passes. `player.remove` is a death with cause `removed`, and victory is checked right after. A system removal is refused during night steps; the moderator may remove at any time.

## Projection (secrecy contract)
`project(state, {kind:'seat', seat})` contains:
- **Public**: step (live votes if `day.openVotes`), seats alive/dead, death cause masked as `'night'` for night deaths, `publicLog`, role counts.
- **Roles**: own role; the pack for wolves; roles revealed publicly; all roles once ended.
- `me.facts`: this seat's knowledge ledger (Seer results, the Witch's victim, the pack target, own actions). A fact is granted only while the seat is alive and entitled under the current settings (e.g. with `witch.seesVictim='never'` the Witch's heal fact has `target:null`). So **ghosts keep but never gain**; tests check the ledger contents are unchanged after death.
- `me.actions`: legal options now, with targets, produced by `check()` (the same validation `apply` uses). Render menus from this list.
- `pack.picks`: live pack picks, only for a living wolf during `night.main`.

`{kind:'public'}` gives public data only (spectators, a host without a seat). `{kind:'moderator'}` adds `moderator: {seats, nightRec, history, knowledge, config}`. At `ended`, everyone gets `reveal.roles` (+ `reveal.history` if `reveal.historyAtEnd`).
Never send `state` itself, and never send a moderator projection to a player seat. Voice and text permissions come from `channelsFor(state, viewer)` / `engine.channels()`.

## Known public side channels (by design, see the proposal)
- A `hunter` step and `shot` reveal the Hunter (Q06/Q20).
- Early close only for the Hunter step by default.

## What the tests prove, and what they don't
- **Engine-level, tested:**
  - views carry only what a seat is entitled to under the selected settings (differential tests, plus randomized matches with invariants checked after every command);
  - ghost ledgers stay identical after death;
  - removed seats can't be announced or shoot;
  - victory waits for the death chain;
  - every provisional key can be swapped.
- **Not proven here; needs server and voice integration evidence:**
  - that the server sends only `view()` output;
  - that reconnecting yields the same view and nothing more;
  - that voice and text membership, rosters, speaking indicators and chat history follow `channels()`;
  - timing and traffic side channels.
