# Moonveil rules proposal

Status: **proposal, v0.4, 2026-10-16** (v0.2: revised after independent review of 9af74b8; v0.3–v0.4: Q10 execution threshold, Q06, Q14, Q20 and Q24 approved). Owner: rules scope (`packages/rules`, `docs/rules`).
Nothing below is an accepted rule unless it is listed under "Approved rules". Every other item is
**provisional** until the Human approves it. The engine implements each provisional recommendation as a named
setting (`config.*`) or one isolated function, so a decision changes a setting, not the engine. Approved rules are
fixed engine behaviour and are no longer settings.

## Decisions needed (summary)

Plain-language summary. "Recommend" is my suggestion only; every open line stays open until you decide. ★ = changed after the review. Decided items are listed separately below the table.

| ID | Question | Recommendation (alternatives are in the item) |
|---|---|---|
| Q03 | Witch | One healing potion and one poison per match, both usable in one night. She is told who the wolves attacked only while she still has her heal. She may heal herself but not poison herself |
| Q07 | Wolves disagree | Wolves see each other's choices. The most-chosen target is attacked; a tie is decided at random |
| Q09 ★ | Who is put on trial | The person with the most votes ("Skip" counts as an option). A tie means nobody |
| Q10 (rest) | Defense and the Yes/No round | 30 s defense where only the accused talks (recommend yes); keep the Yes/No round (recommend yes; without it the approved threshold would never apply); the accused may vote (recommend yes) |
| Q11 ★ | Timers | Nights always last the same time (60 s), even if roles are dead, so night length gives nothing away. Votes also run to the end of their timer, so the last voter can't decide the outcome by watching everyone else |
| Q25 | Voice and text | Day: everyone talks. Night: only living wolves, on their own channel. Defense: only the accused talks. Ghosts: their own channel, and they hear the day talk. Moderator hears everything |
| Q26 | Someone drops during the night | What they already chose stands; anything missing counts as "do nothing". Nobody is told. Removing them waits until morning (except by the moderator) |
| Q15 | Disconnected players | They stay in the game. Only the moderator, or the host after a long disconnect, can remove them |
| Q16 | Moderator powers | Runs the pace, can act for a player, can set the day result after a show of hands, can remove a player or stop the match. Cannot break the rules, bring anyone back or undo |
| Q17 ★ | Roles per player count | About one Wolf per three players (table in Q17). At 6 players, Hunter instead of Witch, and the app refuses custom setups that the Wolves could win on the very first night |
| Q18 | Number of players | 6 to 16 (16 still to be checked with the real screens and voice) |

Low-stakes defaults you could accept as a group: Q01, Q02, Q04, Q05, Q08, Q12, Q13, Q19, Q21, Q22, Q23.

**Decided 2026-10-16** (details in "Approved rules"):
- Q10: the execution threshold.
- Q06: the Hunter.
- Q14: zero survivors is a draw.
- Q20: no role reveal on death.
- Q24: ghost knowledge.

## Approved rules (binding)

- Exactly six roles: Wolf, Villager, Seer, Guard, Witch, Hunter. Factions: Wolves = Wolf; Village = all others.
- Wolves win when living Wolves ≥ living Village members (special roles included).
- Village wins when no Wolves are alive.
- All simultaneous deaths and linked effects (for example the Hunter) resolve before victory is checked.
- Ghosts keep only what they legitimately knew while alive. No one learns secrets they are not entitled to.
- Both a separate human moderator and automatic orchestration are supported. A room creator who plays gets no secret access.
- **Q06 Hunter (approved 2026-10-16).**
  - A *gameplay* death from any cause (night attack, poison, daytime execution, another Hunter's shot) gives the Hunter 20 s to shoot one living player. If time runs out, there is no shot.
  - The shot, and any death chain it causes, resolves before victory is checked.
  - While the shot is pending, the Hunter gets no ghost voice or text (including ghost-chat history) and no new ghost-only knowledge.
  - Administrative removal (by the moderator, or by the host for a disconnected player) is not a gameplay death and gives no shot.
- **Q14 Zero survivors (approved 2026-10-16).** If nobody survives after all pending Hunter shots and death chains have resolved, the match is a draw.
- **Q20 Role reveal (approved 2026-10-16).** No role is revealed on death. All roles are revealed at match end. A Hunter is revealed by their shot. In practice the shot turn is public, so the Hunter is identified when it opens, even if they then let the time run out.
- **Q24 Ghost knowledge (approved 2026-10-16).** Ghosts keep what they legitimately learned while alive. They gain no additional secret roles, actions or wolf-channel access. Public events and ghost conversation are allowed, subject to the Hunter's pending-shot isolation (Q06). Not covered by this approval: whether the full night history is also shown at match end (`reveal.historyAtEnd`, still provisional).
- **Day execution threshold (approved 2026-10-16).** In the Yes/No round, the accused is executed only if `Yes × 2 > number of living players`: a strict majority of *all* living players. Abstaining or not voting does not shrink the count, and disconnected players still count as living. (Players removed from the match are dead and no longer count.) Examples: 10 living, 6 Yes executes; 5 Yes doesn't; 3 Yes + 2 No doesn't. 7 living needs 4 Yes. The approval covers only this threshold. Nomination (Q09), vote visibility (Q22) and the rest of Q10 stay provisional.

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

## Q03 Witch: potions, timing and what she sees — product decision needed
- **sky2 doc**: one heal and one poison; the poison goes through protection (LUAT §3).
- **sky2 code**: one of each (DIS:966). The catalog says that once the heal is used, she is no longer told who was attacked (DIS:966). The UI offers the heal only on the wolves' victim (play:986-988), and that panel disappears once the heal is spent (AV1:913). She may use both potions in the same night, because they are separate slots (AV1:362). She can heal herself.
- **Recommend**: one heal and one poison per match; both may be used in the same night. She acts after the Wolves and sees the victim only while her heal is unused. The heal works only on tonight's victim (self allowed); the poison may hit any other living player.
- **Alternatives**: (a) she always sees the victim; (b) at most one potion per night; (c) no self-heal.
- **Why**: matches sky2 as played, and hiding the victim after the heal keeps a used-up Witch from being an information source.
- **Engine**: `witch.seesVictim` (`whileHealUnused` | `always` | `never`), `witch.bothPotionsSameNight`, `witch.canHealSelf`.

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

## Q07 Wolves disagree — product decision needed
- **sky2 doc**: the alpha wolf decides; without an alpha, one of the picks is chosen at random (LUAT §7.4).
- **sky2 code**: same (AV1:1014-1023). The random choice is fixed once per night (AV1:1017-1018). The pack sees each other's picks live (AV1:587-605, 636-640).
- **Recommend**: the pack sees picks live and can change them. When the step closes, the target picked by the most wolves wins, and a tie is broken at random (seeded, so it can be replayed). If no wolf picks, nobody is attacked. The moderator may set the pack's target directly.
- **Alternatives**: (a) unanimous or no kill; (b) random among all picks (sky2 without an alpha).
- **Why**: there is no alpha among the six roles. Plurality rewards agreement without letting one wolf block the kill.
- **Engine**: `wolves.resolve` (`plurality` | `unanimous` | `random`), `wolves.mayPass`.

## Q08 Abstentions — low-stakes default
- **sky2 code**: every night action and the day vote have a "Skip" option (AV1:305-324, 349-354). Not acting before the timer ends counts as a skip.
- **Recommend**: same. Every night role may pass. By day, "Skip" is an explicit option (Q09). Not voting counts as abstaining and is not "Skip".
- **Engine**: `wolves.mayPass`; the vote rules follow Q09 and Q10.

## Q09 Nomination: threshold and ties — product decision needed
- **sky2 doc and code**: the top target needs more than 50% of *living* players (AV1:950, 958). "Skip" is counted as an option (AV1:950). Ties are picked arbitrarily (AV1:968-977), but they can never pass the 50% bar.
- **Recommend**: the player with the most votes is nominated. "Skip" counts as a candidate. A tie at the top (including a tie with "Skip") means no nomination. Non-voters are ignored.
- **Alternatives**: (a) sky2's majority of living players. It is safer, but with 7–10 players it produces many days without an execution, which favors the Wolves. (b) A runoff vote between the tied players.
- **Why**: plurality keeps days moving with 7–10 players. ★ Corrected after review: in v0.1 I wrote that the Yes/No vote "already requires a majority", which overstated the safeguard at the time.
- **How this interacts with the approved Q10 threshold**: nomination only decides *who* faces the Yes/No round; nobody can be executed without Yes from a majority of all living players. So a plurality nomination with few votes is safe; it just leads to a vote that fails. The alternative "nomination needs a majority of living players" would stack a second majority on top. It would mean fewer trials and fewer executions, which helps the Wolves. I still recommend plurality.
- **Engine**: `day.nomination` (`plurality` | `majorityOfLiving`); tie rule in `tallyNomination()`.

## Q10 Defense interval and Yes/No vote — partly decided
- **sky2 doc and code**: no defense step. The Yes/No vote is on by default (`isNeedVote=true`, AV1:98). Execution needs Yes from more than 50% of living players (AV1:955), so not voting counts against.
- **DECIDED (Human, 2026-10-16): execution threshold.** `Yes × 2 > all living players` (see Approved rules). The other options I offered after review F4 ("Yes > No plus half participation", "Yes > No among votes cast") are rejected. Fixed in the engine; not a setting.
- **Still open, recommendation unchanged:**
  - a defense step of 30 s in which only the nominee speaks (voice enforcement belongs to the server);
  - then Yes/No for 15 s;
  - the nominee may vote;
  - votes are open (Q22).
- **Still-open alternatives:**
  - no defense step;
  - no Yes/No round, so the nominee is executed directly. Note: this would bypass the approved threshold entirely, so I recommend keeping the round;
  - the nominee may not vote (they still count as living in the threshold).
- **Effect of the decision:** silent, absent and disconnected players now count against execution. Expect more days without an execution than under v0.2, which tends to help the Wolves; balance screening will measure this.
- **Engine**: `tallyConfirm()` (approved, fixed); provisional: `day.defense`, `day.confirmVote`, `day.accusedVotesOnConfirm`.

## Q11 Secret-phase timing — product decision needed
- **sky2 code**: defaults are day 90 s, night 120 s, wolf choice 40 s and vote 45 s (AV1:60-77). When everyone has acted, the timer drops to 5 s (AV1:375-377, 453-465). When a role is dead, sky2 adds a random fake delay so that nobody can tell (AV1:761-769, 816-821, 828-831).
- **Server today (foundation, ADR 0001)**: automatic mode never closes a secret phase early, so every phase runs a fixed deadline.
- **Recommend: fixed.** The main night step is 40 s and the Witch step 20 s, so each night lasts 60 s. That is the same every night, whatever has happened and whoever is alive. The Witch step runs whenever the match has a Witch, even if she is dead. Anything not submitted is a pass. The discussion runs its full time unless the moderator ends it. Votes: see the ★ part below. In moderator mode the moderator sets the pace and accepts that their own timing is a cue (ADR 0001).
- **Trade-off**: fixed nights cost about 20–40 s per night when everyone is quick, which over 4–6 nights is 2–4 min per match. Ending early in any form leaks information. "Night ended fast" means that every night actor is done or dead, which over a few nights reveals that the Witch or Seer is dead. Even sky2's random delay leaks statistically, because the extra time depends on hidden state.
- **Alternatives**: (a) adaptive: end once all *living* actors are done, plus a random 5–15 s (sky2), which is faster but leaks; (b) fixed but shorter (30 s + 15 s), which is faster with more players timing out; (c) players may tap "ready", with the night still fixed.
- **★ Ending votes early (review finding F6).** Votes are open and changeable (Q22). If a vote closes the moment everyone has voted, the last person to vote sees everyone else's choice and settles the outcome with no chance to react. Options:
  - **A (recommend)**: votes stay open and changeable until their fixed deadline (30 s nomination, 15 s Yes/No). Only the Hunter's shot may end early, since it is one person's choice and there's nothing to react to. Cost: up to about 45 s per day.
  - **B**: end early once everyone has voted, and tell players plainly that the last vote decides. Optionally, a 5 s grace period restarts whenever anyone changes their vote.
- **Engine**: `timing.*`, `timing.nightEarlyClose=false`, `timing.publicEarlyClose=false` (option A), `stepTiming()`. The host contract reports `secret=true` and `earlyClose=false` for night steps. This covers only the engine's own signals; server timers, moderator pacing and network traffic are tested separately (by foundation).

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

## Q15 Disconnected or leaving players — product decision needed
- **sky2 code**: there is no concept of a disconnected player. Identity comes from a device cookie (MSS:224-250). Missing actions simply time out.
- **Recommend**: a disconnected player stays in the game, keeps their seat and role, and their missed actions are passes or abstentions. Reconnecting restores the same seat (server). There is no automatic elimination. The moderator, or the host when the player has been disconnected for at least 2 minutes (a server rule), may **remove** a player. Removal by the host or server waits until the night is over (Q26). Removal is a death with cause "removed": no Hunter shot (approved, Q06), and victory is checked.
- **Alternatives**: automatic removal after N missed phases; a bot takes over the seat.
- **Engine**: command `player.remove`; the authority check belongs to the server.

## Q16 Moderator powers — product decision needed
- **Interaction with the approved Q10 threshold**: "set the day result after a show of hands" lets the moderator decide an execution the engine can't count. Options: (a) the moderator enters the Yes count and the engine applies `Yes × 2 > living`; (b) the moderator applies the rule by hand (as now). I recommend (a); it isn't built yet.
- **sky2 code**: in moderator mode the moderator enters every night action (MSC:136-140) and can eliminate anyone by day with no checks (MSC:142-146, MSS:707-734). In automatic mode the admin shows or hides boards and forces submission (AV1:186-237, 383-403).
- **Recommend**: the moderator is a separate seat with no role and sees everything. They may: close any step at any time; submit or change any seat's action (for in-room play by gesture); set the wolves' target; set the day result directly (for example after a show of hands); remove a player; abort the match. Every moderator action is validated by the same rules and logged in the moderator view. No reviving, no undo, no changing roles in this version.
- **Alternatives**: the moderator may break rules (free override); add undo of the last step.
- **Engine**: actor `moderator`; `moderator.mayBreakRules=false`; `moderator.canSetDayOutcome=true`.

## Q17 Role distribution — product decision needed
- **sky2 code**: no table. The host types counts per role. If there are more roles than players, roles are removed at random, and if a Wolf is removed, every Wolf gains the curse (MSS:187-204).
- **Recommend** (W = Wolf, V = Villager):

| Players | W | Seer | Witch | Guard | Hunter | V |
|---|---|---|---|---|---|---|
| 6 ★ | 2 | 1 | 0 | 1 | 1 | 1 |
| 7 | 2 | 1 | 1 | 1 | 1 | 1 |
| 8 | 2 | 1 | 1 | 1 | 1 | 2 |
| 9 | 2 | 1 | 1 | 1 | 1 | 3 |
| 10 | 3 | 1 | 1 | 1 | 1 | 3 |
| 11 | 3 | 1 | 1 | 1 | 1 | 4 |
| 12 | 3 | 1 | 1 | 1 | 1 | 5 |
| 13 | 4 | 1 | 1 | 1 | 1 | 5 |
| 14 | 4 | 1 | 1 | 1 | 1 | 6 |
| 15 | 4 | 1 | 1 | 1 | 1 | 7 |
| 16 | 5 | 1 | 1 | 1 | 1 | 7 |

  The host may customize, with limits: at least 1 Wolf; Wolves fewer than the Village; at most 1 of each special role; total = player count. The full role list (counts only) is public at the start.
- **Why**: about one Wolf per three players. The parity rule already favors the Wolves, so the table stays at the lower end. Balance needs playtesting.
- **★ Setups the Wolves win on night 1 (review finding F3).** Some legal setups end the match at the first dawn. 7 players = 3 Wolves + 4 Villagers reaches 3 v 3 after one bite. The v0.1 6-player preset (2 Wolves, Seer, Witch, Guard, Villager) reaches 2 v 2 if the Witch poisons a villager on night 1. The approved win rule stays; the question is which setups to allow.
  - **Check on custom setups**:
    - **A (recommend)**: refuse a setup if one bite plus the Witch's poison(s) on night 1 could make Wolves ≥ everyone else.
    - **B**: count only the bite.
    - **C**: no check; it's the host's responsibility.
  - **6 players**:
    - **i (recommend)**: 2 Wolves, Seer, Guard, Hunter, Villager (no Witch).
    - **ii**: raise the minimum to 7.
    - **iii**: keep the Witch, but no attack on night 1 at 6 players (Q23).
  - Every preset for 7–16 passes check A. At 7 players the margin is still thin: one wrong execution plus one bite reaches parity at the second dawn, unless the Guard or Witch saves someone. Balance screening by bots will follow in a later update.
- **Engine**: `distribution` table, `limits.maxPerSpecialRole`, `limits.firstDawnParityCheck` (`biteAndPoison` = A | `biteOnly` = B | `off` = C); `validateDeck()`.

## Q18 Minimum and maximum players — product decision needed
- **sky2 code**: only checks that the total is above 0 (MSS:126). No maximum.
- **Recommend**: minimum 6 (with the 6-player setup from Q17 option i; option ii would make it 7), maximum 16. The engine has no hard limit; 16 is bounded by seats around the campfire, voice and match length, and needs verifying.
- **Engine**: `players.min`, `players.max`.

## Q19 Expected match duration — low-stakes default (numbers are tunable)
- **sky2 code**: about 4.5 min per cycle with its defaults (AV1:60-77).
- **Recommend timers**: night main 40 s, Witch 20 s, discussion 60 s + 15 s per living player (90–240 s), nomination 30 s, defense 30 s, Yes/No 15 s, Hunter 20 s. One cycle is about 5–6 min with 8 alive. Expected matches are 15–30 min for 7–10 players and 30–45 min for 12–16.
- **Engine**: `timing.*`, `stepTiming()`.

## Q20 Reveal a role on death? — DECIDED 2026-10-16
- **Decision**: no reveal on death; all roles at match end; the Hunter is revealed by their shot. The engine publishes `roleRevealed` for the Hunter when the public shot turn opens.
- **Context**: the sky2 public history shows names only (MSS:686, 720), but its dead players could read every role (AV1C:73), which Q24 rules out.
- **Engine**: fixed (the `reveal.roleOnDeath` setting was removed); tests in `test/approved.test.ts` and in the randomized invariants.

## Q21 What dawn announces — low-stakes default
- **sky2 code**: the dead are listed in resolution order, so bites appear before poison (MSS:674-686). The order leaks the cause of death.
- **Recommend**: dawn lists only the names of the dead, sorted by seat, with no cause. "Nobody died" when no one died. Execution and the Hunter's shot are public by nature.
- **Engine**: `reveal.causeAtDawn=false`.

## Q22 Vote visibility — low-stakes default
- **sky2 code**: votes are live and open, showing who voted for whom (AV1:527, 665-696).
- **Recommend**: open live votes, which players may change until close, for both the nomination and Yes/No. Votes run to their deadline (Q11 ★ option A).
- **Alternatives**: secret votes with only the totals shown at close.
- **Engine**: `day.openVotes`.

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

## Q25 Voice and text channels — product decision needed
- **Brief**: ghost rules approved (see the table above). "Public communication during daytime; private wolf communication at night; ghost communication separate" is a working proposal.
- **sky2 code**: text only. The wolf chat is for living wolves; the "all" chat is for everyone (LUAT §1). There is no voice.
- **Recommend**:

| When | Living Wolf | Other living | Ghost | Moderator |
|---|---|---|---|---|
| Night | Wolf channel (talk) | Silent | Ghost channel + hears public | Hears everything |
| Day (discussion, votes) | Public (talk) | Public (talk) | Ghost channel + hears public | Public (talk) + hears all |
| Defense | Listen; only the nominee talks | Listen; only the nominee talks | Ghost channel + hears public | Same |
| Hunter's 20 s shot | Public (talk) | Public (talk) | The shooting Hunter: hears public only (approved, Q06); other ghosts as usual | Same |
| Match end | Public (all) | Public (all) | Public (all) | Public (all) |

  The same grants apply to text and emotes. In-person play keeps voice off (a server/room setting), and wolves use text at night.
- **Alternatives**: wolves also have a private channel by day (stronger wolves); living players hear public at night (pointless, since nobody may speak); the moderator does not hear the wolves.
- **Engine**: `channelsFor()`; `comms.wolvesAtNight`, `comms.livingHearPublicAtNight`, `comms.defenseOnlyAccusedSpeaks`, `comms.moderatorHearsAll`. The pending-Hunter rule is approved and fixed (not a setting). The engine only *computes* grants. Whether voice and text actually obey them (membership, rosters, speaking indicators, chat history) needs evidence from the server and voice integration.

## Q26 Disconnects during secret phases — product decision needed
- **Server today (ADR 0001)**: presence shown to players is frozen during secret phases, so nobody sees who dropped at night. The moderator sees it live.
- **sky2 code**: there is no presence concept; missing actions time out (AV1:979-1002).
- **Recommend**:
  - an action submitted before the drop stands, and can still be changed after reconnecting before the step closes;
  - if nothing was submitted, it counts as a pass when the fixed step ends: no kill vote from that wolf (the other wolves' picks decide), no inspection, no protection, no potion;
  - a disconnected wolf's earlier pick still counts toward the pack's choice;
  - nothing is announced, and reconnecting restores the same seat and knowledge;
  - removal by the host or server is refused during night steps, because a removal at night would publish a night-time event. It waits for the day. The moderator may still remove at any time.
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
