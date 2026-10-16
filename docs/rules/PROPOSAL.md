# Moonveil rules proposal

Status: **proposal, v0.1, 2026-10-16**. Owner: rules scope (`packages/rules`, `docs/rules`).
Nothing below is an accepted rule unless it is listed under "Approved rules". Every other item is
**provisional** until the Human approves it. The engine implements each recommendation as a named
setting (`config.*`) or one isolated function, so a decision changes a setting, not the engine.

## Decisions needed (summary)

| ID | Question | Recommendation |
|---|---|---|
| Q14 | Everyone dies at once (zero survivors) | **Draw**, nobody wins |
| Q06 | Hunter | Hunter shoots one living player whenever they die (night, poison or execution); 20 s; no shot on timeout |
| Q03 | Witch | One heal and one poison per match; may use both in one night; sees the wolves' victim only while the heal is unused; may heal self, may not poison self |
| Q07 | Wolves disagree | Pack sees each other's picks live. At close, most-picked target wins; a tie is broken at random |
| Q09 | Nomination threshold and ties | Most votes wins, "Skip" counts as an option, a tie at the top means no execution |
| Q10 | Defense and Yes/No vote | Both on: 30 s defense, then Yes/No. Execute if Yes > No among votes cast |
| Q20 | Reveal a role on death? | **No.** Roles are revealed at match end (reading of the brief; please confirm) |
| Q11 | Secret-phase timing | Fixed night: 40 s for the main step plus 20 s for the Witch, every night, even when roles are dead. No adaptive end. Public steps may end early |
| Q15 | Disconnected players | They stay in the game; missed actions count as skips. Only the moderator, or the host for a player who is disconnected, may remove them |
| Q24 | What a ghost keeps and sees | Keeps everything they legitimately learned while alive (own role, Seer results, wolf teammates, the Witch's victims, own actions). Gains nothing new. Sees only public events plus ghost chat |
| Q25 | Voice/text channels | Day: public. Night: living wolves only, on the wolf channel. Defense: only the nominee speaks. Ghosts: ghost channel plus listening to public. The moderator hears everything |
| Q26 | Disconnect during the night | A submitted action stands; a missing one is a pass. The drop stays hidden until day. Removal waits for the day (moderator excepted) |
| Q16 | Moderator powers | Run the pace, act for any seat, set the day outcome by show of hands, remove a player, abort. Cannot break the rules, revive or undo |
| Q17 | Role distribution | Table in Q17 (2 Wolves for 6–9 players, 3 for 10–12, 4 for 13–15, 5 for 16). Host may customize within limits |
| Q18 | Player count | Minimum 6, maximum 16 (the maximum must be confirmed by UI and voice tests) |

Low-stakes defaults (sensible to accept as a batch): Q01, Q02, Q04, Q05, Q08, Q12, Q13, Q19, Q21–Q23.

## Approved rules (binding)

- Exactly six roles: Wolf, Villager, Seer, Guard, Witch, Hunter. Factions: Wolves = Wolf; Village = all others.
- Wolves win when living Wolves ≥ living Village members (special roles included).
- Village wins when no Wolves are alive.
- All simultaneous deaths and linked effects (for example the Hunter) resolve before victory is checked.
- Ghosts keep only what they legitimately knew while alive. No one learns secrets they are not entitled to.
- Both a separate human moderator and automatic orchestration are supported. A room creator who plays gets no secret access.

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

## Q06 Hunter: trigger and timing — product decision needed
- **sky2 doc**: the Hunter pins one player each night; only if the Hunter dies *at night* does the pinned player die too (LUAT §3, DIS:969). With 1 Hunter and 1 Wolf left, the match ends with no winner (LUAT §2).
- **sky2 code**: the pin is taken every night (MSS:549-550). The linked death applies only inside night resolution (MSS:644-660), and it happens even if the pinned player was protected (saves at MSS:623 run before the chain at MSS:629). Dying by execution does nothing (MSS:707-734).
- **Recommend**: "shoot on death". When the Hunter dies for any reason (bite, poison or execution), they get 20 s to shoot one living player, or to pass. If time runs out, there is no shot. Being removed for leaving does not allow a shot. The shot is part of the same batch of deaths, so victory is checked after it.
- **Alternatives**: (a) sky2's nightly pin, triggered by night death only. It keeps the night secret and needs no pause, but a pin chosen before the day's discussion is often stale, and execution does nothing. (b) Shoot on death except when poisoned.
- **Why**: the classic, widely known rule. It covers execution and gives the Hunter a real decision. Cost: the shot shows publicly who the Hunter was (see Q20).
- **Engine**: `hunter.mode` (`shootOnDeath` | `pinNightOnly`), `hunter.shootsWhenPoisoned`, `hunter.shootsWhenRemoved`.

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
- **Why**: the Yes/No vote (Q10) already requires a majority before anyone is executed.
- **Engine**: `day.nomination` (`plurality` | `majorityOfLiving`); tie rule in `tallyNomination()`.

## Q10 Defense interval and Yes/No vote — product decision needed
- **sky2 doc and code**: no defense step. The Yes/No vote is on by default (`isNeedVote=true`, AV1:98). Execution needs Yes from more than 50% of living players (AV1:955), so not voting counts against.
- **Recommend**: defense 30 s, in which only the nominee speaks (voice enforcement belongs to the server). Then Yes/No for 15 s. Execute if Yes > No among votes cast; a tie means no execution. The nominee may vote. Votes are open (Q22).
- **Alternatives**: (a) no Yes/No: the nominee is executed directly; (b) sky2's bar of Yes > 50% of living players; (c) no defense step.
- **Why**: a defense gives the accused a voice, and the vote among votes cast keeps disconnected players from blocking the day.
- **Engine**: `day.defense`, `day.confirmVote`, `day.confirm` (`majorityOfCast` | `majorityOfLiving`), `day.accusedVotesOnConfirm`.

## Q11 Secret-phase timing — product decision needed
- **sky2 code**: defaults are day 90 s, night 120 s, wolf choice 40 s and vote 45 s (AV1:60-77). When everyone has acted, the timer drops to 5 s (AV1:375-377, 453-465). When a role is dead, sky2 adds a random fake delay so that nobody can tell (AV1:761-769, 816-821, 828-831).
- **Server today (foundation, ADR 0001)**: automatic mode never closes a secret phase early, so every phase runs a fixed deadline.
- **Recommend: fixed.** The main night step is 40 s and the Witch step 20 s, so each night lasts 60 s. That is the same every night, whatever has happened and whoever is alive. The Witch step runs whenever the match has a Witch, even if she is dead. Anything not submitted is a pass. Public steps (votes, Hunter) may end early once everyone eligible has acted. The discussion runs its full time unless the moderator ends it. In moderator mode the moderator sets the pace and accepts that their own timing is a cue (ADR 0001).
- **Trade-off**: fixed nights cost about 20–40 s per night when everyone is quick, which over 4–6 nights is 2–4 min per match. Ending early in any form leaks information. "Night ended fast" means that every night actor is done or dead, which over a few nights reveals that the Witch or Seer is dead. Even sky2's random delay leaks statistically, because the extra time depends on hidden state.
- **Alternatives**: (a) adaptive: end once all *living* actors are done, plus a random 5–15 s (sky2), which is faster but leaks; (b) fixed but shorter (30 s + 15 s), which is faster with more players timing out; (c) players may tap "ready", with the night still fixed.
- **Engine**: `timing.*`, `timing.nightEarlyClose=false`, `stepTiming()`; the host contract reports `secret=true` and `earlyClose=false` for night steps.

## Q12 When victory is checked — low-stakes default (follows the approved rules)
- **sky2 code**: victory is checked after the night (AV1:1001) and after an execution (AV1:1170). Moderator mode never checks it; the moderator ends the match by hand (MSC:130-146).
- **Recommend**: check only after a batch of deaths is fully resolved: at dawn after Hunter shots, after an execution and its Hunter shots, and after a removal. Never in the middle of a batch. A win at dawn ends the match before the day. Moderator mode uses the same check.
- **Engine**: `evaluateVictory()`; called by `finishBatch()`.

## Q13 Simultaneous deaths and death chains — low-stakes default
- **sky2 code**: night deaths are collected, saves are applied, poison is added, then linked deaths repeat until nothing changes. Everything is announced together (MSS:621-660).
- **Recommend**: all deaths in a step happen at once. Then every Hunter who died shoots at the same time. Their targets die together as a new batch, and a newly dead Hunter shoots in turn. Victory is checked only after the chain ends.
- **Engine**: `resolveNight()`, Hunter step, `finishBatch()`.

## Q14 Zero survivors — product decision needed
- **Fact**: when everyone is dead, both approved win statements are literally true (0 Wolves alive, and 0 ≥ 0). Example: 1 Wolf, Witch and Hunter. The Wolf bites the Hunter and the Witch poisons the Wolf; the Hunter shoots the Witch.
- **sky2 doc and code**: "The world collapses", with no winner (LUAT §2; AV1:1064-1066).
- **Recommend**: a **draw**; nobody wins.
- **Alternatives**: Village wins (its goal "no Wolves alive" was met); Wolves win.
- **Engine**: `victory.zeroSurvivors` (`draw` | `village` | `wolves`).

## Q15 Disconnected or leaving players — product decision needed
- **sky2 code**: there is no concept of a disconnected player. Identity comes from a device cookie (MSS:224-250). Missing actions simply time out.
- **Recommend**: a disconnected player stays in the game, keeps their seat and role, and their missed actions are passes or abstentions. Reconnecting restores the same seat (server). There is no automatic elimination. The moderator, or the host when the player has been disconnected for at least 2 minutes (a server rule), may **remove** a player. Removal by the host or server waits until the night is over (Q26). Removal is a death with cause "left": no Hunter shot (`hunter.shootsWhenRemoved=false`), and victory is checked.
- **Alternatives**: automatic removal after N missed phases; a bot takes over the seat.
- **Engine**: command `player.remove`; the authority check belongs to the server.

## Q16 Moderator powers — product decision needed
- **sky2 code**: in moderator mode the moderator enters every night action (MSC:136-140) and can eliminate anyone by day with no checks (MSC:142-146, MSS:707-734). In automatic mode the admin shows or hides boards and forces submission (AV1:186-237, 383-403).
- **Recommend**: the moderator is a separate seat with no role and sees everything. They may: close any step at any time; submit or change any seat's action (for in-room play by gesture); set the wolves' target; set the day result directly (for example after a show of hands); remove a player; abort the match. Every moderator action is validated by the same rules and logged in the moderator view. No reviving, no undo, no changing roles in this version.
- **Alternatives**: the moderator may break rules (free override); add undo of the last step.
- **Engine**: actor `moderator`; `moderator.mayBreakRules=false`; `moderator.canSetDayOutcome=true`.

## Q17 Role distribution — product decision needed
- **sky2 code**: no table. The host types counts per role. If there are more roles than players, roles are removed at random, and if a Wolf is removed, every Wolf gains the curse (MSS:187-204).
- **Recommend** (W = Wolf, V = Villager):

| Players | W | Seer | Witch | Guard | Hunter | V |
|---|---|---|---|---|---|---|
| 6 | 2 | 1 | 1 | 1 | 0 | 1 |
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
- **Engine**: `distribution` table and `limits.maxPerSpecialRole`; `validateDeck()`.

## Q18 Minimum and maximum players — product decision needed
- **sky2 code**: only checks that the total is above 0 (MSS:126). No maximum.
- **Recommend**: minimum 6, maximum 16. The engine has no hard limit; 16 is bounded by seats around the campfire, voice and match length, and needs verifying.
- **Engine**: `players.min`, `players.max`.

## Q19 Expected match duration — low-stakes default (numbers are tunable)
- **sky2 code**: about 4.5 min per cycle with its defaults (AV1:60-77).
- **Recommend timers**: night main 40 s, Witch 20 s, discussion 60 s + 15 s per living player (90–240 s), nomination 30 s, defense 30 s, Yes/No 15 s, Hunter 20 s. One cycle is about 5–6 min with 8 alive. Expected matches are 15–30 min for 7–10 players and 30–45 min for 12–16.
- **Engine**: `timing.*`, `stepTiming()`.

## Q20 Reveal a role on death? — product decision needed (confirm reading of the brief)
- **Brief**: "Reveal roles at match end."
- **sky2 code**: the public history shows only "X was eliminated" (MSS:686, 720). Dead players can read the full history, roles included (AV1C:73; MSC:82-85, `allowDeadViewGameHistory=true` MSS:53). That contradicts the brief's ghost rule.
- **Recommend**: no reveal on death; all roles are revealed at match end. Known exception: a Hunter's shot is public, so it reveals the Hunter.
- **Alternatives**: reveal on death (classic; more information for the Village and fewer bluffs).
- **Engine**: `reveal.roleOnDeath`.

## Q21 What dawn announces — low-stakes default
- **sky2 code**: the dead are listed in resolution order, so bites appear before poison (MSS:674-686). The order leaks the cause of death.
- **Recommend**: dawn lists only the names of the dead, sorted by seat, with no cause. "Nobody died" when no one died. Execution and the Hunter's shot are public by nature.
- **Engine**: `reveal.causeAtDawn=false`.

## Q22 Vote visibility — low-stakes default
- **sky2 code**: votes are live and open, showing who voted for whom (AV1:527, 665-696).
- **Recommend**: open live votes, which players may change until close, for both the nomination and Yes/No.
- **Alternatives**: secret votes with only the totals shown at close.
- **Engine**: `day.openVotes`.

## Q23 First phase — low-stakes default
- **sky2**: starts at night (the admin opens the night board first).
- **Recommend**: the match starts at night; the Wolves may attack on night 1.
- **Engine**: `firstNightKill`.

## Q24 What a ghost keeps and sees — product decision needed (resolves an ambiguity in the brief)
- **Brief**: "Ghosts cannot inspect secret roles/actions or hear the wolf channel" (approved). "Whether eliminated players retain any knowledge they legitimately held before death needs no new reveal" can be read two ways: (a) ghosts keep what they knew, or (b) ghosts are reset to public information.
- **sky2 code**: the opposite of both readings. Dead players get the whole history, roles included (AV1C:73).
- **Recommend (a)**: keep, never gain.

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
| Ghost chat; listening to public discussion | Yes (approved); cannot speak to the living |
| All roles and the full night history | At match end only, like everyone |

- **Why (a)**: reconnecting must never change what a seat knows, and wiping knowledge would make a ghost's screen contradict what they remember. A ghost cannot pass information to the living in the app; real-world talk can't be controlled either way.
- **Known effect**: ghosts may share what they know on the ghost channel (a dead Seer can tell other ghosts). That affects no living player.
- **Alternatives**: (b) reset to public only; (c) ghosts see everything, as a spectator mode. That contradicts the approved "cannot inspect secret roles" rule.
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
| Match end | Public (all) | Public (all) | Public (all) | Public (all) |

  The same grants apply to text and emotes. In-person play keeps voice off (a server/room setting), and wolves use text at night.
- **Alternatives**: wolves also have a private channel by day (stronger wolves); living players hear public at night (pointless, since nobody may speak); the moderator does not hear the wolves.
- **Engine**: `channelsFor()`; `comms.wolvesAtNight`, `comms.livingHearPublicAtNight`, `comms.defenseOnlyAccusedSpeaks`, `comms.moderatorHearsAll`.

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

## Other findings from sky2 (evidence for the projection requirement)

- AV1 broadcasts the state for viewer `null` to every client (AV1:504-506). With `null`, the Seer's result, the wolves' picks and the Witch's victim list are all included (AV1:632-644), and every device's action menu is included too (AV1:530, 890-899), which reveals roles. Moonveil must project per seat on the server; the engine provides `project()`.
- Dead players get the full history with roles (AV1C:73), which violates the brief's ghost rule.
- The Guard's repeat rule is enforced only in the UI (Q02).
