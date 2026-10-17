# Moonveil rules proposal

Status: **proposal, v0.12, 2026-10-18**. v0.2 was revised after an independent review of 9af74b8; v0.3 to v0.12 record your decisions (v0.11: Batch B pace; v0.12: open speech during defense). Owner: rules scope (`packages/rules`, `docs/rules`).
Only what is listed under "Approved rules" is accepted. Everything else is **provisional** until you approve it.
The engine implements each provisional recommendation as a named setting (`config.*`) or one isolated function.
Approved rules are fixed engine behaviour, no longer settings.
**Start here for open items:** `DECISIONS_REMAINING.md` (one page, batched). Related drafts (all provisional): `BALANCE.md` (bot screening), `NARRATION.md` (phase text, EN/VI), `QUICK_REFERENCE.md` (player help).

## Still open (summary)

Plain language. "Recommend" is only my suggestion.

| ID | Question | Recommendation (alternatives are in the item) |
|---|---|---|
| Q15/Q26 (removal) | Removing a disconnected player | Only the moderator (any time) or the host after a 2-minute disconnect (not during the night) may remove; removal is a death with no Hunter shot |
| Q16 (rest) | Moderator powers beyond listening and the Yes count | Runs the pace, can act for a player, can set the wolves' target, can remove a player or stop the match. Speaking in public: recommend allowing it; currently **off** until you decide. Cannot break the rules, bring anyone back or undo |
| Q08 | Wolves choosing "nobody" | Allowed. "Nobody" wins only if it alone has the most wolf choices |
| Q10 (rest) | May the accused vote in their own Yes/No round? | Yes |

Low-stakes defaults you could accept as a group: Q01, Q02, Q04, Q05, Q12, Q13, Q21, Q23.

## Approved rules (binding)

**Core (brief):**
- Exactly six roles: Wolf, Villager, Seer, Guard, Witch, Hunter. Factions: Wolves = Wolf; Village = all others.
- Wolves win when living Wolves ≥ living Village members (special roles included).
- The Village wins when no Wolves are alive.
- All simultaneous deaths and linked effects resolve before victory is checked.
- Nobody learns secrets they aren't entitled to.
- Both a human moderator and automatic orchestration are supported. A room creator who plays gets no secret access.

**Decided 2026-10-16:**
- **Table size and roles (Q17/Q18, Batch A).**
  - 7 to 15 players; 6 and 16+ are rejected when a match is created.
  - Default roles: 2 Wolves at 7–12 players, 3 at 13–15; exactly one each of Seer, Witch, Guard and Hunter; the rest Villagers.
  - The host may customize within limits: at most one of each special role, at least one Wolf, fewer Wolves than Village, and no setup the Wolves could win on the first night (one bite plus the Witch's poison).
- **Witch (Q03).**
  - One heal and one poison per match; both may be used on the same night.
  - She may heal herself, but may not poison herself.
  - She sees the wolves' victim only while her heal is unused.
- **Wolf target (Q07).** Living wolves see one another's picks. The target with the most wolf votes is attacked; a tie is broken at random among the tied top targets. *Not covered:* the moderator setting the wolf target (Q16), "wolves can't target a wolf" (Q01), and how "nobody" picks count (Q08).
- **Trial (Q09/Q10).**
  - The player with the single highest nomination count goes on trial; no majority is needed. "Skip" is a counted option.
  - No votes at all, a tie for the highest count (including a tie with Skip), or Skip leading means no trial and no execution that day.
  - The accused gets a 30 s defense, then the Yes/No round.
- **Execution threshold (Q10).**
  - Executed only if `Yes × 2 > number of living players`. Abstentions and disconnected players still count as living; players removed from the match don't.
  - Examples: with 10 living, 6 Yes executes; 5 Yes doesn't; 3 Yes + 2 No doesn't. With 7 living, 4 Yes are needed.
- **Moderator Yes count (Q16).** For a show of hands, the moderator may enter the Yes count, and the engine applies the threshold. The moderator can't override it; there's no "set the result" command. The count must be a whole number from 0 to the current number of living players.
- **Night timing (Q11).** Every night lasts a fixed 60 s, whatever roles survive and however early actions finish, so timing reveals no roles. Both night steps always run their full length, even if the Witch is dead, her heal is spent, or the setup has no Witch.
- **Day votes (Q11/Q22).**
  - Nomination and the Yes/No round both run to their deadline; nothing ends early.
  - **Open ballots, shown live (approved 2026-10-16; this correction supersedes the earlier ballot-secrecy approval and the "voted status only" approval of the same day).**
    - Nomination: every view shows each voter and their chosen target, or Skip, as soon as they vote.
    - Yes/No: every view shows each voter and their Yes or No.
    - Changed votes and reconnects show the current choices. Counts follow from the public choices; nothing about the tally is secret.
  - Unchanged: fixed deadlines (no early close), the execution threshold, the nomination rule and the defense. Night actions stay private, and wolf picks stay wolf-only.
  - *Not covered:* what the moderator sees mid-vote (provisional, currently everything).
- **Pace (Q11/Q19, Batch B, approved 2026-10-17).** Fixed durations, not settings:
  - Night: 40 s for Wolves, Seer and Guard, then 20 s for the Witch (60 s in total).
  - Discussion: 60 s + 15 s per living player, at least 90 s and at most 240 s (7 alive: 165 s; 12 or more: 240 s).
  - Nomination 30 s; defense 30 s; Yes/No 15 s.
  - Hunter: 20 s. The turn ends as soon as the shot is taken (or the Hunter holds fire); otherwise at 20 s with no shot.
  - Tests: `test/batch-b.test.ts`.
- **Hunter (Q06).**
  - Any gameplay death (night attack, poison, execution, another Hunter's shot) gives a 20 s turn to shoot one living player. On timeout, there is no shot.
  - The shot and any chain it causes resolve before victory is checked.
  - While the shot is pending, the Hunter has no ghost voice or text (including history) and gains no ghost-only knowledge.
  - Removal by the moderator or host isn't a gameplay death and gives no shot.
- **Zero survivors (Q14).** If nobody survives after all shots and chains resolve, the match is a draw.
- **Stalemate draw (F1, option A).**
  - A full cycle is a night followed by its day. The boundary is the end of that day, after the day's execution, any Hunter shot and the death chain have resolved.
  - When 3 consecutive cycles pass with no gameplay death (bite, poison, execution, Hunter shot), the match ends as a draw, reason "stalemate". Any gameplay death resets the count; an administrative removal does not.
  - A warning goes out at the boundary that completes the 2nd no-death cycle: "If nobody dies before the end of the next day, the match ends in a draw."
  - Order at each boundary: Hunter shots and chains, then the win check, then the stalemate check. End-of-match disclosure and channels work as at any other end.
- **Moderator ends the match (Q16).** In moderator mode, the separate moderator may end the match at any time. It ends with no winner (moderator-ended), with normal end-of-match disclosure (all roles revealed; ended channels). A participating host or any player can't do this, and no winner can be assigned. The UI asks for deliberate confirmation; the engine requires an explicit confirmation in the command itself.
- **Role reveal (Q20).**
  - No role is revealed on death; all roles are revealed at match end.
  - Exception: the Hunter is revealed when their 20 s shot turn opens, even if it times out. (Rejected alternative: a uniform post-death window after every death, about 20 s per death, roughly 2–3 min per match.)
- **Ghosts (Q24).** Ghosts keep what they legitimately learned while alive, and gain no new secret roles, actions or wolf-channel access. They get public events and ghost conversation, subject to the Hunter's pending-shot isolation. *Not covered:* showing the full night history at match end (`reveal.historyAtEnd`).
- **Disconnected players (Q15/Q26, except removal).**
  - Choices already submitted stay; a missing choice becomes a pass at the deadline.
  - Disconnected players stay alive and count in the execution threshold.
  - Reconnecting restores the same identity, role and state, with no extra knowledge.
  - **No immunity for being offline (binding clarification):**
    - A disconnected player can still be nominated and executed, and bitten or poisoned at night.
    - Reconnecting never resurrects: a player eliminated while offline returns as a ghost.
    - A Hunter eliminated while offline still gets the 20 s shot turn. If they reconnect in time they may shoot, with no ghost access until the turn resolves; otherwise it times out with no shot.
    - Tests: `test/offline.test.ts`.
- **Pause in automatic mode.**
  - Game timers pause while *all* player seats are disconnected, and resume when any player reconnects. A connected moderator or spectator doesn't prevent the pause.
  - Time spent paused never expires a phase; on resume the phase has exactly the time left that it had when it paused.
- **Voice and text channels (Q25).**
  - Day: living players speak and listen in public.
  - Night: only living wolves communicate, on the private wolf channel; nobody else speaks.
  - Defense (approved 2026-10-18; supersedes the 2026-10-16 clause "only the accused speaks; others listen"): every living player may speak in public, as well as the accused. The accused keeps the defense focus and the 30 s timer. There is no push-to-talk queue.
  - Ghosts speak and listen on the ghost channel and listen to public, never the wolf channel (pending Hunter excepted, as above).
  - The moderator listens to every channel.
  - No channel membership, participant list or speaking indicator reaches a seat without the matching access.
  - *Not covered:* the moderator speaking or intervening (provisional; speech is off by default, `moderator.speaksInPublic=false`).

Consequence to note: parity ends the match immediately, even when the Village still has a Witch's poison or a
Hunter. Example: 1 Wolf and 1 Hunter alive means the Wolves win. sky2 called that case a draw (AV1:1105-1111).

## Evidence key

- `LUAT §n` = `/Users/long/repo/games/sky2/LUAT_CHOI_MA_SOI.md` section n.
- Code paths are relative to `sky2/src/main/`. MSS = `java/.../service/MaSoiService.java`, AV1 = `java/.../service/MaSoiAutoV1.java`
  (automatic mode), AV1C = `java/.../controller/MaSoiAutoV1Controller.java`, MSC = `java/.../controller/MaSoiController.java`
  (moderator mode), DIS = `java/.../service/DataInputService.java` (role catalog), play = `resources/templates/masoiAutoV1/play.html`.
- sky2 was read, not run. Where the doc and the code disagree, both are given.

## Night and day order (recommended, used by the engine)

1. **Night, main step**: Wolves pick a victim, the Seer inspects, the Guard protects. All happen at the same time and privately.
2. **Night, Witch step**: the Witch may heal the victim and/or poison someone.
3. **Dawn**: the names of the dead are announced. A dead Hunter shoots (Q06). Then victory is checked.
4. **Day**: discussion → nomination vote → defense → Yes/No vote → execution → Hunter shot → victory check → next night.

---

## Q01 Self-targeting — low-stakes default
- **sky2 doc**: Seer and Hunter may not target themselves (LUAT §7.2).
- **sky2 code**: self-targeting is blocked only in the UI, for Seer and Hunter (AV1:44; play:999). The Guard may protect self and the Witch may heal or poison self. Wolves may target anyone alive, including a wolf or themselves (AV1:326-337 checks only that the target is alive). A player may vote for themselves by day (AV1:262-281).
- **Recommend**: Seer no. Guard yes. Witch may heal self, but may not poison self. Wolves may not target a Wolf. Hunter may not shoot self. No self-vote by day.
- **Alternatives**: no Guard self-protection (weaker Guard); allow wolves to target wolves (bluffing).
- **Why**: removes moves that are pointless or accidental, and keeps sky2's familiar Guard and Witch powers.
- **Engine**: `guard.canProtectSelf`, `witch.canHealSelf`, `witch.canPoisonSelf`, `wolves.canTargetWolf`, `day.selfVote`.

## Q02 Guard: protecting the same player again — low-stakes default
- **sky2 doc**: the Guard may not protect the same player on two nights in a row (LUAT §7.1, DIS:968).
- **sky2 code**: the server does not enforce this (AV1:326-381). The UI greys out the old target (play:1001-1003), but it reads a value fixed at page load. Skipping a night clears the restriction (AV1:996-999).
- **Recommend**: not the same player on two consecutive nights. Self counts as a player. A night with no protection resets the restriction. The server enforces it.
- **Alternatives**: no restriction; never the same player twice in the whole match.
- **Engine**: `guard.noRepeatTarget`, `guard.passResetsRepeat`.

## Q03 Witch: potions, timing and what she sees — DECIDED 2026-10-16
- **sky2 doc**: one heal and one poison; the poison goes through protection (LUAT §3).
- **sky2 code**: one of each (DIS:966). The catalog says that once the heal is used, she is no longer told who was attacked (DIS:966). The UI offers the heal only on the wolves' victim (play:986-988), and that panel disappears once the heal is spent (AV1:913). She may use both potions in the same night, because they are separate slots (AV1:362). She can heal herself.
- **Decision**: as recommended (see Approved rules). The heal works only on tonight's victim (self allowed); the poison may hit any other living player.
- **Rejected alternatives**: she always sees the victim; at most one potion per night; no self-heal.
- **Engine**: fixed (the `witch.*` settings were removed); `witchSeesVictim()`; tests in `test/decisions.test.ts`. A moderator with `mayBreakRules` cannot bypass these rules.

## Q04 Witch and Guard interactions — low-stakes default
- **sky2 code**: the poison cannot be prevented (MSS:492-493, 624). Guard protection and the Witch's heal both just remove the bite (MSS:528, 623). Protecting someone twice has no side effect.
- **Recommend**: the Guard blocks only the wolf bite, not poison. If the Guard and the heal cover the same victim, the victim lives. The Witch sees the wolves' choice even when the Guard protects it, and a heal she uses on it is still spent.
- **Alternatives**: "double protection kills" (a house rule in some groups); the Guard also blocks poison.
- **Engine**: `protection.guardBlocksPoison`, `protection.doubleProtectionKills`.

## Q05 What the Seer learns — low-stakes default
- **sky2 doc**: the result is "Wolf" or "Village" (LUAT §3).
- **sky2 code**: the result is shown immediately when the Seer picks, and the choice then locks (AV1:610-620; play lock). It is inverted when the Seer is silenced (`invertedSeer=true`, MSS:59, 574-576), which cannot happen with six roles.
- **Recommend**: "Wolf" or "Not a Wolf", shown privately as soon as the Seer confirms. One inspection per night, no self-inspection. The Seer keeps the result even if they die that night.
- **Alternatives**: exact role (much stronger); result delivered at dawn.
- **Engine**: `seer.result` (`wolfOrNot` | `exactRole`).

## Q06 Hunter: trigger and timing — DECIDED 2026-10-16
- **Decision**: see Approved rules. "Shoot on death" with a 20 s window, any gameplay death, no shot on timeout, and resolution before victory. While the shot is pending the Hunter is isolated from ghosts (review option F1-A). Removal gives no shot.
- **Rejected alternatives**: sky2's nightly pin (LUAT §3, DIS:969; MSS:549-550, 644-660; execution did nothing, MSS:707-734); no shot when poisoned; a standing target locked while alive; letting the pending Hunter join ghost chat.
- **Engine**: fixed. `hunterTriggers()`, `afterDeaths()`, `isPendingHunter()` and `channelsFor()`; tests in `test/hunter.test.ts`. The pin mode and its settings were removed.

## Q07 Wolves disagree — DECIDED 2026-10-16 (target rule)
- **sky2 doc**: the alpha wolf decides; without an alpha, one of the picks is chosen at random (LUAT §7.4).
- **sky2 code**: same (AV1:1014-1023). The random choice is fixed once per night (AV1:1017-1018). The pack sees each other's picks live (AV1:587-605, 636-640).
- **Decision**: living wolves see one another's picks; the most-picked target is attacked; ties are broken at random (seeded) among the tied top targets.
- **Still provisional**: no picks means no attack, and how "nobody" picks count (Q08, `wolves.passHandling`); the moderator setting the target (Q16, `moderator.canSetWolfTarget`); "wolves can't target a wolf" (Q01).
- **Rejected alternatives**: unanimous or no kill; random among all picks.
- **Engine**: fixed `resolveWolfTarget()`; tests in `test/decisions.test.ts`.

## Q08 Abstentions — low-stakes default
- **sky2 code**: every night action and the day vote have a "Skip" option (AV1:305-324, 349-354). Not acting before the timer ends counts as a skip.
- **Recommend**: same. Every night role may pass. By day, "Skip" is an explicit option (Q09). Not voting counts as abstaining and is not "Skip".
- **Wolves' "nobody" pick (still provisional)**: counted as an option; it prevents the attack only if it alone has the most picks. Alternative: passes are ignored (`wolves.passHandling='ignored'`).
- **Engine**: `wolves.mayPass`, `wolves.passHandling`; the day vote rules are approved (Q09/Q10).

## Q09 Nomination: threshold and ties — DECIDED 2026-10-16
- **sky2 doc and code**: the top target needs more than 50% of *living* players (AV1:950, 958). "Skip" is counted as an option (AV1:950). Ties are picked arbitrarily (AV1:968-977), but they can never pass the 50% bar.
- **Decision**: the single highest count goes on trial, with no majority needed. "Skip" is counted. No votes, a tie at the top (including a tie with Skip), or Skip leading means no trial and no execution that day.
- **Alternatives**: (a) sky2's majority of living players. It is safer, but with 7–10 players it produces many days without an execution, which favors the Wolves. (b) A runoff vote between the tied players.
- **Why**: plurality keeps days moving with 7–10 players. ★ Corrected after review: in v0.1 I wrote that the Yes/No vote "already requires a majority", which overstated the safeguard at the time.
- **How this interacts with the approved Q10 threshold**: nomination only decides *who* faces the Yes/No round; nobody can be executed without Yes from a majority of all living players. So a plurality nomination with few votes is safe; it just leads to a vote that fails. The alternative "nomination needs a majority of living players" would stack a second majority on top. It would mean fewer trials and fewer executions, which helps the Wolves. I still recommend plurality.
- **Engine**: fixed `tallyNomination()` (the `day.nomination` setting was removed); tests in `test/decisions.test.ts`.

## Q10 Defense interval and Yes/No vote — DECIDED 2026-10-16 (except whether the accused votes)
- **sky2 doc and code**: no defense step. The Yes/No vote is on by default (`isNeedVote=true`, AV1:98). Execution needs Yes from more than 50% of living players (AV1:955), so not voting counts against.
- **DECIDED (Human, 2026-10-16): execution threshold.** `Yes × 2 > all living players` (see Approved rules). The other options I offered after review F4 ("Yes > No plus half participation", "Yes > No among votes cast") are rejected. Fixed in the engine; not a setting.
- **DECIDED (2026-10-16)**: the accused always gets a 30 s defense, always followed by the Yes/No round. Speech during it: every living player may speak (approved 2026-10-18, Q25; this supersedes "only the accused speaks").
- **Still open**: whether the accused may vote in their own round (recommend yes; either way they count as living). The Yes/No duration (15 s) is approved (Batch B).
- **Effect of the decision:** silent, absent and disconnected players now count against execution. Expect more days without an execution than under v0.2, which tends to help the Wolves; balance screening will measure this.
- **Engine**: fixed `tallyConfirm()`, `DEFENSE_SECONDS = 30`, defense → confirm always; provisional: `day.accusedVotesOnConfirm`.

## Q11 Secret-phase timing — DECIDED 2026-10-16 (60 s nights; votes run to deadline); split DECIDED 2026-10-17 (Batch B)
- **sky2 code**: defaults are day 90 s, night 120 s, wolf choice 40 s and vote 45 s (AV1:60-77). When everyone has acted, the timer drops to 5 s (AV1:375-377, 453-465). When a role is dead, sky2 adds a random fake delay so that nobody can tell (AV1:761-769, 816-821, 828-831).
- **Server today (foundation, ADR 0001)**: automatic mode never closes a secret phase early, so every phase runs a fixed deadline.
- **DECIDED**: every night is a fixed 60 s, never ending early, whoever survives. Both night steps always run their full length (even with no Witch in the setup). **DECIDED 2026-10-17 (B1)**: 40 s main + 20 s Witch (rejected: 45 + 15). Anything not submitted is a pass. The discussion runs its full time unless the moderator ends it. Votes: see the ★ part below. In moderator mode the moderator sets the pace and accepts that their own timing is a cue (ADR 0001).
- **Trade-off**: fixed nights cost about 20–40 s per night when everyone is quick, which over 4–6 nights is 2–4 min per match. Ending early in any form leaks information. "Night ended fast" means that every night actor is done or dead, which over a few nights reveals that the Witch or Seer is dead. Even sky2's random delay leaks statistically, because the extra time depends on hidden state.
- **Alternatives**: (a) adaptive: end once all *living* actors are done, plus a random 5–15 s (sky2), which is faster but leaks; (b) fixed but shorter (30 s + 15 s), which is faster with more players timing out; (c) players may tap "ready", with the night still fixed.
- **★ Ending votes early (review finding F6).** Votes are open and changeable (Q22). If a vote closes the moment everyone has voted, the last person to vote sees everyone else's choice and settles the outcome with no chance to react (with open ballots this matters even more). Options:
  - **A (DECIDED 2026-10-16)**: votes stay open and changeable until their fixed deadline. Ballots are public and live (Q22). The Hunter's turn may still end early once the shot is taken (approved, B4). Cost: up to about 45 s per day.
  - **B**: end early once everyone has voted, and tell players plainly that the last vote decides. Optionally, a 5 s grace period restarts whenever anyone changes their vote.
- **Engine**: fixed constants `NIGHT_TOTAL_SECONDS = 60`, `NIGHT_MAIN_SECONDS = 40` (Q19 for the rest); the `timing.*` settings were removed; `stepTiming()` never reports early close for night or vote steps. The host contract reports `secret=true` and `earlyClose=false` for night steps. This covers only the engine's own signals; server timers, moderator pacing and network traffic are tested separately (by foundation).

## Q12 When victory is checked — low-stakes default (follows the approved rules)
- **sky2 code**: victory is checked after the night (AV1:1001) and after an execution (AV1:1170). Moderator mode never checks it; the moderator ends the match by hand (MSC:130-146).
- **Recommend**: check only after a batch of deaths is fully resolved: at dawn after Hunter shots, after an execution and its Hunter shots, and after a removal. Never in the middle of a batch. A win at dawn ends the match before the day. Moderator mode uses the same check.
- **Engine**: `evaluateVictory()`; called by `finishBatch()`.

## Q13 Simultaneous deaths and death chains — low-stakes default
- **sky2 code**: night deaths are collected, saves are applied, poison is added, then linked deaths repeat until nothing changes. Everything is announced together (MSS:621-660).
- **Recommend**: all deaths in a step happen at once. Then every Hunter who died shoots at the same time. Their targets die together as a new batch, and a newly dead Hunter shoots in turn. Victory is checked only after the chain ends.
- **Engine**: `resolveNight()`, Hunter step, `finishBatch()`.

## Q14 Zero survivors — DECIDED 2026-10-16
- **Decision**: draw, judged after all pending Hunter shots and chains have resolved. Both approved win statements are literally true at zero survivors (0 Wolves alive, and 0 ≥ 0); this decision settles that. sky2 had the same outcome ("the world collapses", LUAT §2; AV1:1064-1066).
- **Engine**: fixed in `evaluateVictory()`; tests in `test/approved.test.ts` and `test/hunter.test.ts`.

## Q15 Disconnected or leaving players — DECIDED 2026-10-16 (except removal)
- **sky2 code**: there is no concept of a disconnected player. Identity comes from a device cookie (MSS:224-250). Missing actions simply time out.
- **Decision**: a disconnected player stays alive and in the game; missed actions become passes; they count in the execution threshold; reconnecting restores the same seat, role and state with no extra knowledge. In automatic mode the timers pause while all player seats are disconnected (see Approved rules).
- **Still open (removal)**: the moderator, or the host when the player has been disconnected for at least 2 minutes (a server rule), may **remove** a player. Removal by the host or server waits until the night is over (Q26). Removal is a death with cause "removed": no Hunter shot (approved, Q06), and victory is checked.
- **Alternatives**: automatic removal after N missed phases; a bot takes over the seat.
- **Engine**: no presence in the engine (passes at close); the pause is `PhaseClock` with host `sync`, `tick`, `pause`, `resume` and `timer` (see API.md); `player.remove` is provisional. Tests in `test/disconnect.test.ts`.

## Q16 Moderator powers — partly decided
- **DECIDED parts (2026-10-16)**: for a show of hands, the moderator enters the Yes count (`day.confirmCount`) and the engine applies the approved threshold; the direct "set the day result" power has been removed. The moderator may also end the match with no winner (`match.end`, with an explicit confirm).
- **Still open — how the trial itself is chosen in person**: today the moderator can only enter each player's nomination vote on their behalf (act for a seat). Options: (a) keep that; (b) add a moderator "nominee by show of hands" entry. I recommend (a) for now; (b) would be a new power and needs your decision.
- **sky2 code**: in moderator mode the moderator enters every night action (MSC:136-140) and can eliminate anyone by day with no checks (MSC:142-146, MSS:707-734). In automatic mode the admin shows or hides boards and forces submission (AV1:186-237, 383-403).
- **Recommend**: the moderator is a separate seat with no role and sees everything. They may: close any step at any time; submit or change any seat's action (for in-room play by gesture); set the wolves' target; remove a player; abort the match. (Entering the Yes count is approved, see above.) Every moderator action is validated by the same rules and logged in the moderator view. No reviving, no undo, no changing roles in this version.
- **Alternatives**: the moderator may break rules (free override); add undo of the last step.
- **Engine**: actor `moderator`; `moderator.mayBreakRules=false`; `moderator.canSetDayOutcome=true`.

## Q17 Role distribution — DECIDED 2026-10-16 (Batch A)
- **Decision**: see Approved rules. Default table:

| Players | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|
| Wolves | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 |
| Seer / Witch / Guard / Hunter | 1 each | 1 each | 1 each | 1 each | 1 each | 1 each | 1 each | 1 each | 1 each |
| Villagers | 1 | 2 | 3 | 4 | 5 | 6 | 6 | 7 | 8 |

- **Evidence**: bot screen (`BALANCE.md`, open ballots): Village wins 42–50% with 2 Wolves at 7–9 players and 55–57% at 10–12; with 3 Wolves, 27–34% at 13–15. Bots overstate the Wolves at large tables, so the table sits at the Village-friendly end; playtests will tune it.
- **History**: v0.1 proposed about one Wolf per three players (3 Wolves at 10–12, 4 at 13–15) and supported 6 and 16; the bot screen and review finding F3 led to this revision. sky2 had no table: the host typed counts, and extra roles were removed at random (MSS:187-204).
- **Engine**: fixed `DEFAULT_DECKS`, `MAX_PER_SPECIAL_ROLE = 1`, `validateDeck()` (the first-night check is always on); the `distribution` and `limits.*` settings were removed. Tests: `test/batch-a.test.ts`.

## Q18 Minimum and maximum players — DECIDED 2026-10-16 (Batch A)
- **Decision**: 7 to 15 players. 6 was lopsided either way in the bot screen (Village 21% with 2 Wolves, 65% with 1); 16 was strongly wolf-favoured (3–12%). sky2 only checked that the total was above 0 (MSS:126).
- **Engine**: fixed `PLAYERS_MIN = 7`, `PLAYERS_MAX = 15`; the host engine reports them as `minPlayers`/`maxPlayers`; the `players.*` settings were removed.

## Q19 Expected match duration — DECIDED 2026-10-17 (Batch B)
- **sky2 code**: about 4.5 min per cycle with its defaults (AV1:60-77).
- **DECIDED (B1–B4, as recommended)**: night main 40 s, Witch 20 s, discussion 60 s + 15 s per living player (90–240 s), nomination 30 s, defense 30 s, Yes/No 15 s, Hunter 20 s, ending once the shot is taken. One cycle is about 5–6 min with 8 alive. Expected matches are 15–30 min for 7–10 players and 30–45 min for 12–16.
- **Measured by bots (`BALANCE.md`, upper bound; votes and nights always run their full time)**: median 11–16 min at 7–9 players, 20–26 min at 10–12, 24–30 min at 13–16.
- **Rejected alternatives**: a flat 3 min discussion (B2); 45 s / 20 s / 20 s for nomination / Yes/No / Hunter (B3); always waiting the full 20 s for the Hunter (B4).
- **Engine**: fixed constants in `config.ts` (`NIGHT_MAIN_SECONDS`, `DISCUSSION_*_SECONDS`, `VOTE_SECONDS`, `CONFIRM_SECONDS`, `HUNTER_SECONDS`), `discussionSeconds()`, `stepTiming()`; the `timing.*` settings were removed and are rejected as unknown. Tests: `test/batch-b.test.ts`.

## Q20 Reveal a role on death? — DECIDED 2026-10-16
- **Decision**: no reveal on death; all roles at match end. Hunter exception: the Hunter is revealed when the shot turn opens, even on timeout (approved 2026-10-16). The engine publishes `roleRevealed` for the Hunter at that moment. The uniform post-death window was the rejected alternative (about 20 s per death batch).
- **Context**: the sky2 public history shows names only (MSS:686, 720), but its dead players could read every role (AV1C:73), which Q24 rules out.
- **Engine**: fixed (the `reveal.roleOnDeath` setting was removed); tests in `test/approved.test.ts` and in the randomized invariants.

## Q21 What dawn announces — low-stakes default
- **sky2 code**: the dead are listed in resolution order, so bites appear before poison (MSS:674-686). The order leaks the cause of death.
- **Recommend**: dawn lists only the names of the dead, sorted by seat, with no cause. "Nobody died" when no one died. Execution and the Hunter's shot are public by nature.
- **Engine**: `reveal.causeAtDawn=false`.

## Q22 Vote visibility — DECIDED 2026-10-16 (open ballots)
- **sky2 code**: votes are live and open, showing who voted for whom (AV1:527, 665-696).
- **DECIDED (2026-10-16, correction)**: day votes are **open ballots, shown live**. Every view (players, ghosts, public, moderator, reconnects) shows each voter's current choice, and the result event at close repeats the full ballot list with the totals. This supersedes two earlier approvals of the same day: hidden interim ballots, and "who has voted" without choices.
- **Engine**: fixed; `stepView()` returns `votes` (choices) and `voted` (derived flags) to every viewer; the `day.revealBallotsAtClose` and `moderator.seesLiveBallots` settings were removed. Tests in `test/ballots.test.ts`.

## Q23 First phase — low-stakes default
- **sky2**: starts at night (the admin opens the night board first).
- **Recommend**: the match starts at night; the Wolves may attack on night 1.
- **Alternative**: no attack on night 1, either always or only for small games (see Q17 option iii).
- **Engine**: `firstNightKill`.

## Q24 What a ghost keeps and sees — DECIDED 2026-10-16 (reading (a): keep, never gain)
- **Brief**: "Ghosts cannot inspect secret roles/actions or hear the wolf channel" (approved). "Whether eliminated players retain any knowledge they legitimately held before death needs no new reveal" can be read two ways: (a) ghosts keep what they knew, or (b) ghosts are reset to public information.
- **sky2 code**: the opposite of both readings. Dead players get the whole history, roles included (AV1C:73).
- **Decision (a)**: keep, never gain. The table below is the approved behaviour; the end-of-match *history* line stays provisional.

| Ghost… | Keeps / sees? |
|---|---|
| Own role | Yes |
| Wolf teammates (if a Wolf) | Yes (known since the start) |
| The pack's past targets up to their death (if a Wolf) | Yes |
| Seer results obtained while alive | Yes, including the result from the night they died |
| The Witch's victims seen, own potions and actions | Yes |
| The Guard's own past protections; the Hunter's own pins | Yes |
| Anything new after death: wolf picks, wolf chat, new results, the Witch's new victim, others' roles | **No** |
| Public events (deaths, votes, executions, shots) | Yes, like the living |
| Ghost chat; listening to public discussion | Yes (approved); cannot speak to the living. Exception: a Hunter whose shot is pending hears public only (Q06 ★) |
| All roles | At match end, like everyone (approved, Q20) |
| Full night history | At match end (provisional: `reveal.historyAtEnd`) |

- **Why (a)**: reconnecting must never change what a seat knows, and wiping knowledge would make a ghost's screen contradict what they remember. A ghost cannot pass information to the living in the app; real-world talk can't be controlled either way.
- **Known effect**: ghosts may share what they know on the ghost channel (a dead Seer can tell other ghosts). That affects no living player.
- **Rejected alternatives**: (b) reset to public only; (c) ghosts see everything, as a spectator mode.
- **Engine**: per-seat knowledge ledger; facts are granted only to living seats (tested: "ghost knowledge is frozen at death"); `reveal.historyAtEnd`.

## Q25 Voice and text channels — DECIDED 2026-10-16 (except moderator speaking); defense row changed 2026-10-18
- **Brief**: ghost rules approved (see the table above). "Public communication during daytime; private wolf communication at night; ghost communication separate" is a working proposal.
- **sky2 code**: text only. The wolf chat is for living wolves; the "all" chat is for everyone (LUAT §1). There is no voice.
- **Decision** (moderator *speaking* still provisional):

| When | Living Wolf | Other living | Ghost | Moderator |
|---|---|---|---|---|
| Night | Wolf channel (talk) | Silent | Ghost channel + hears public | Hears everything |
| Day (discussion, votes) | Public (talk) | Public (talk) | Ghost channel + hears public | Hears all; talking in public is provisional and off by default |
| Defense (2026-10-18) | Public (talk); the accused has the focus and timer | Public (talk) | Ghost channel + hears public | Same |
| Hunter's 20 s shot | Public (talk) | Public (talk) | The shooting Hunter: hears public only (approved, Q06); other ghosts as usual | Same |
| Match end | Public (all) | Public (all) | Public (all) | Public (all) |

  *Superseded:* the 2026-10-16 defense row ("Listen; only the nominee talks") was replaced on 2026-10-18. Nothing else in the table changed.

  The same grants apply to text and emotes. In-person play keeps voice off (a server/room setting), and wolves use text at night.
- **No leaks (approved)**: no channel membership, participant list or speaking indicator reaches a seat without the matching grant. The engine never puts channel data in views; enforcement is the server's and voice's.
- **Engine**: fixed `channelsFor()`; the old `comms.*` settings are removed and now rejected if passed (strict config). The only provisional part is `moderator.speaksInPublic` (default `false`). Tests: the grant table across phases (`test/decisions.test.ts`), open defense speech (`test/defense-speech.test.ts`), and the approved table against every combination of provisional settings (`test/channels-invariant.test.ts`). The engine only *computes* grants. Whether voice and text actually obey them (membership, rosters, speaking indicators, chat history) needs evidence from the server and voice integration.

## Q26 Disconnects during secret phases — DECIDED 2026-10-16 (except removal)
- **Server today (ADR 0001)**: presence shown to players is frozen during secret phases, so nobody sees who dropped at night. The moderator sees it live.
- **sky2 code**: there is no presence concept; missing actions time out (AV1:979-1002).
- **Decided**:
  - an action submitted before the drop stands, and can still be changed after reconnecting before the step closes;
  - if nothing was submitted, it counts as a pass when the fixed step ends: no kill vote from that wolf (the other wolves' picks decide), no inspection, no protection, no potion;
  - a disconnected wolf's earlier pick still counts toward the pack's choice;
  - nothing is announced, and reconnecting restores the same seat and knowledge;
- **Still open (removal)**: removal by the host or server is refused during night steps, because a removal at night would publish a night-time event; it waits for the day. The moderator may still remove at any time.
- **Alternatives**: a bot submits a random legal action (keeps balance, but surprises); hidden auto-removal at dawn.
- **Engine**: no presence in the engine. `removal.systemDuringSecret=false` (the moderator is exempt).

## What the engine tests prove, and what they don't
- **Proven by engine tests:** per-seat views carry only what a seat is entitled to under the selected settings. Ghost knowledge is identical before and after further play. Night death resolution and the Hunter chain run before victory is checked. Every provisional setting can be swapped.
- **Not proven by engine tests:**
  - that the server sends only these views;
  - that reconnecting grants nothing new;
  - that voice and text follow the channel grants (membership, rosters, speaking indicators);
  - timing or traffic side channels.
  These need server and voice integration evidence.

## Other findings from sky2 (evidence for the projection requirement)

- AV1 broadcasts the state for viewer `null` to every client (AV1:504-506). With `null`, the Seer's result, the wolves' picks and the Witch's victim list are all included (AV1:632-644), and every device's action menu is included too (AV1:530, 890-899), which reveals roles. Moonveil must project per seat on the server; the engine provides `project()`.
- Dead players get the full history with roles (AV1C:73), which violates the brief's ghost rule.
- The Guard's repeat rule is enforced only in the UI (Q02).
