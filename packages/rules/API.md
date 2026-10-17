# @moonveil/rules — API (v0.3)

Pure, deterministic TypeScript engine with no IO, timers, network or runtime dependencies. The server hosts it.
Rules live in `docs/rules/PROPOSAL.md`. **Approved rules are fixed behaviour; every `config` key is provisional** until the Human approves it (`PROVISIONAL` maps each key to its proposal item).

**Approved 2026-10-16 (fixed):**
- the six roles; victory (parity, no wolves, zero survivors = draw); resolve-before-victory;
- Q03 Witch; Q06 Hunter; Q07 wolf plurality;
- Q09/Q10 trial, 30 s defense and Yes/No with `Yes × 2 > all living`; Q16 moderator Yes count;
- Q11 fixed 60 s nights, never early; day votes run to their deadline as open ballots shown live (Q22);
- Q20 reveals; Q24 ghosts; Q25 channels (except moderator speaking, which is provisional and **off** by default);
- disconnected seats and the automatic-mode pause.

**Approved 2026-10-17 (fixed): Batch B durations.** Night 40 + 20 s; discussion 60 s + 15 s × living, clamped 90–240 s (`discussionSeconds(living)`); nomination 30 s; defense 30 s; Yes/No 15 s; Hunter 20 s, `earlyCloseReady` once every pending Hunter has shot or held fire. Exported constants: `NIGHT_TOTAL_SECONDS`, `NIGHT_MAIN_SECONDS`, `DISCUSSION_{BASE,PER_ALIVE,MIN,MAX}_SECONDS`, `VOTE_SECONDS`, `DEFENSE_SECONDS`, `CONFIRM_SECONDS`, `HUNTER_SECONDS`. The `timing.*` settings were removed.

## Run
```
npm run check -w @moonveil/rules     # from the repo root via node scripts/env.mjs; typecheck (all + src without host types) + tests
```
- Toolchain: the foundation root (Node ≥ 24.12 running `.ts` directly, TypeScript 7.0.2, `tsconfig.base.json`). `src` typechecks with no host types (`tsconfig.src.json`).
- `exports["."] = ./src/index.ts`.

## Host contract (for the server)
```ts
import { createRulesEngine } from '@moonveil/rules';
const engine = createRulesEngine({ config?, deck? });   // RulesEngine<HostState>; HostState = { seatIds, match, clock }
```
| Member | Notes |
|---|---|
| `id`, `minPlayers`, `maxPlayers` | approved Batch A: 7 and 15 (fixed; `PLAYERS_MIN`/`PLAYERS_MAX`) |
| `setup({seats, seed})` | seeded role assignment; `clock` starts `null`. Call `sync(now)` next in automatic mode |
| `phase(s) -> {name, secret, durationMs, earlyClose, ended}` | `secret` = night steps. `earlyClose` is true only for the Hunter step once all shots are in; never for night or votes (approved) |
| `submit(s, seatId, action)` | player action = Command without `seat` (the engine injects the actor). Strictly parsed |
| `moderate(s, action)` | moderator Command (seat indices). Approved: `day.confirmCount {yes}` (the engine applies `yes*2 > living`; `yes` must be an integer 0..living at apply time, else `bad_value`); no direct day-result command. Approved: `match.end {confirm: 'end-match'}`, which ends the match with no winner (`outcome {winner:'aborted', reason:'aborted'}`); a missing or wrong confirm gives `bad_value`; moderator only. Provisional: acting for seats (`moderator.canActForSeats`), `wolf.decide` (`moderator.canSetWolfTarget`), `player.remove`, `step.close`. `match.abort` was removed |
| `remove(s, seatId)` | system/host removal (provisional, Q26); refused during night steps. Pending night effects on a removed seat are void |
| `advance(s)` | `step.close` as system (moderator pacing, or the server's optional Hunter early close) |
| `sync(s, now)` | **automatic mode, call after EVERY change** (setup, submit, moderate, remove, advance). Starts a full-length clock when `match.stepSeq` changed; otherwise unchanged |
| `tick(s, now)` | closes the step **only if its clock is running and expired**, then starts the next clock at `now`. Use this, not `advance`, for timer expiry |
| `pause(s, now)` / `resume(s, now)` | freeze / continue the remaining time (idempotent). A step that begins while paused starts paused |
| `timer(s, now) -> {durationMs, remainingMs, deadline, paused} \| null` | `deadline` (absolute ms) is `null` while paused; use it for `phaseEndsAt` and for scheduling the next `tick` |
| `view(s, viewer)` | Projection (below) plus `seatIds` (index → SeatId). Viewers: `{kind:'seat', seat: SeatId}`, `{kind:'moderator'}`, `{kind:'public'}` |
| `channels(s, seatId \| viewer)` | `[{channel:'public'\|'wolves'\|'ghosts', listen, speak}]`, same shape as `VoiceGrant`; for voice **and** text (Q25). No setting can change the approved player/ghost grants; the moderator listens to all, and public speech is only granted if `moderator.speaksInPublic` is set (default `false`) |

Seats inside the game are **indices**; `view().seatIds[i]` is the SeatId, and clients send targets as indices.

## What the server must do (foundation's code; not done here)
1. Replace the fixture engine with `createRulesEngine()`. Use `minPlayers` and `maxPlayers` for `canStart`.
2. Route player `act` → `submit`, and moderator actions → `moderate` (**new route**).
3. **Automatic-mode timing** (approved pause rule):
   - after every change: `s = sync(s, now)`, then schedule a wake at `timer(s, now).deadline`;
   - on wake: `s = tick(s, now)` and reschedule. A stale wake is harmless, since `tick` does nothing unless the phase has expired;
   - when **all player seats** are disconnected: `s = pause(s, now)` and cancel the wake. A connected moderator or spectator does not prevent this. When **any player** reconnects: `s = resume(s, now)` and reschedule;
   - optional Hunter early close: if `phase().earlyClose`, call `advance` then `sync`.
4. Views: per seat `view(s, {kind:'seat', seat})`; moderator `{kind:'moderator'}`; spectators `{kind:'public'}`. Never send `HostState`.
5. Grants: `channels(s, seatId)` for players and `channels(s, {kind:'moderator'})` for the moderator. Recompute them after every change.
6. Host removal of a long-disconnected player → `remove()`. It's refused at night; retry in the day.

### Channel enforcement the server and voice must provide (approved Q25 and Q06)
- **Live voice, text and emotes:** deliver on a channel only to seats whose *current* grant has `listen`, and accept only from `speak`.
- **History** (ghost chat, wolf chat): filter by the grant **at read time** (open, reconnect, scroll-back). A pending Hunter gets no ghost history until the shot resolves.
- **Membership, rosters and speaking indicators** for a channel go only to seats with `listen` on it.
- `isPendingHunter(state, seat)` is exported. While pending, the Hunter's grants are public-listen only; they change to ghost access when the turn resolves.

## Core calls (engine level)
```ts
createMatch({ seed, playerCount } | { seed, roles } | { seed, playerCount, deck }, config?) -> {ok, state} | {ok:false, error}
apply(state, actor, command) -> {ok:true, state} | {ok:false, error:{code, message}}   // never mutates input
check(state, actor, command) -> error | null                                         // same validation, no clone
project(state, viewer) -> Projection
stepTiming(state) -> {seconds, earlyCloseReady}                                   // approved constants; never reads config
startClock / pauseClock / resumeClock / remainingMs / deadlineOf / isExpired          // pure PhaseClock helpers
```
- `state` is plain JSON. Replaying the same commands on the same seed gives the same state. `state.stepSeq` increments on every new step, but not when a step resumes after a removal.
- **Config is strict:** `createMatch`/`createRulesEngine` reject unknown keys (including removed settings such as `comms.*`, `witch.*` and `timing.*`), wrong types and invalid enum values (`createMatch` returns `bad_value`; `resolveConfig` throws).
- Actors: `{kind:'seat', seat}`, `{kind:'moderator'}`, `{kind:'system'}`. A seat issues only its own seat commands. `step.close` and `player.remove` are moderator or system only; `wolf.decide`, `day.confirmCount` and `match.end` are moderator only (never a seat, the host or the system). Unknown commands are rejected with `bad_value`.
- Approved rules can't be bypassed by the provisional `moderator.mayBreakRules`.
- **Stalemate (approved F1-A):** at the end of each day (after Hunter shots, death chains and the win check), a counter of consecutive no-death cycles updates. Any bite, poison, execution or Hunter shot resets it; a removal doesn't. At 2 the engine emits a public `{t:'stalemateWarning', day}` event; show "If nobody dies before the end of the next day, the match ends in a draw." At 3 the match ends with `outcome {winner:'draw', reason:'stalemate'}`. State fields: `quietCycles`, `cycleHadDeath`.
- **Decks (approved Batch A):** `createMatch` rejects player counts outside 7–15 and invalid custom decks (`rule` error). `setup()` throws on them. The default deck is `DEFAULT_DECKS[n]`. There is no way to skip this check through the public API.
- Errors: `forbidden | wrong_step | bad_seat | bad_target | bad_value | rule | locked | ended`. Return them to the caller only.

## Steps (`state.step.kind`)
`night.main` (40 s: `wolf.pick`, `seer.inspect`, `guard.protect`) → `night.witch` (20 s, the rest of the fixed 60 s; **always runs**, even with no or a dead Witch: `witch.heal {use}`, `witch.poison {target|'pass'}`)
→ [`hunter` (20 s, ends once shot, `hunter.shoot`) if a Hunter died] → victory check → `day.discussion` (60 s + 15 s × living, 90–240 s) → `day.vote` (30 s, `vote.nominate {target|'skip'|null}`)
→ [trial: `day.defense` (30 s, fixed) → `day.confirm` (15 s, `vote.confirm {choice|null}` or moderator `day.confirmCount`)] → [`hunter`] → victory check → `night.main` … → `ended`.
Every step closes only on `step.close`/`tick`. Anything not submitted counts as a pass.

## Projection (secrecy contract)
`project(state, {kind:'seat', seat})`:
- **Public:** the step; who is alive or dead (night deaths show the cause `'night'`); `publicLog`; role counts.
- **Votes (approved, open ballots):** while a vote is open, `step.votes[seat]` is that seat's live choice (target / `'skip'` / `'yes'` / `'no'`, or `null` if not voted) for **every** viewer; `step.voted` holds the derived has-voted flags. `me.ballot` repeats the viewer's own choice. At close, `publicLog` gets `nomination`/`confirm` with totals and the full `votes` list (a moderator-entered Yes count has `votes: null`, as it comes from a show of hands).
- **Roles:** own role; the pack for wolves; the Hunter once their shot turn opens; all roles at the end.
- `me.facts`: the seat's knowledge ledger, granted only while alive and entitled (ghosts keep, never gain).
- `me.actions`: legal options with targets, produced by `check()`.
- `pack.picks`: live pack picks, only for a living wolf during `night.main`.

`{kind:'public'}` gives public data only. `{kind:'moderator'}` adds `moderator: {seats, nightRec, history, knowledge, config}`. At `ended`, everyone gets `reveal.roles` (and `reveal.history` if `reveal.historyAtEnd`).

## What the tests prove, and what they don't
- **Engine, tested:**
  - entitlement under the selected settings: differential tests and randomized matches with invariants after every command (night secrets private; day ballots open and matching state);
  - frozen ghost ledgers; the channel grant table across phases, deaths and reconnect;
  - the 60 s night in every role and death combination;
  - exact pause/resume in every phase type; every provisional key swappable.
- **Needs server and voice evidence:** that only `view()` output is sent; reconnect behaviour; voice and text actually obeying `channels()` (membership, rosters, indicators, history); presence detection driving pause/resume; timing and traffic side channels.
