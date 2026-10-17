# Rules still to decide — one page

Status: 2026-10-17, for the decision-maker. Batches A, B and F are decided; everything else below (Batches C–E) is **provisional**. The app already runs on the "Recommend" column, except rows marked ⚠, where a "yes" changes a setting. Details and sky2 evidence: `PROPOSAL.md` (Qxx). Bot results: `BALANCE.md`. Bots are not players.

**Reply format:** "Batch A yes", or "Batch A yes except A3: alternative".
**Blocks first playtest** = needs an answer before colleagues play; everything else can wait for playtest feedback.

## Batch A — Who can play and with which roles — DECIDED 2026-10-16
Approved as recommended:
- 7–15 players;
- 2 Wolves at 7–12, 3 at 13–15;
- exactly one each of Seer, Witch, Guard and Hunter, the rest Villagers;
- the host may customize within limits.

Now fixed in the engine (`PROPOSAL.md` Q17/Q18).

*Follow-up evidence (bots, `BALANCE.md`): at 13–15 players, 3 Wolves screens wolf-favoured even with smarter village bots (Village 35–39%), while 2 Wolves screens village-favoured (64–71%). Watch this in playtests; no decision is requested now.*

## Batch B — Pace — DECIDED 2026-10-17
Approved as recommended:
- B1 night: 40 s for Wolves/Seer/Guard + 20 s for the Witch (60 s total);
- B2 discussion: 60 s + 15 s per living player, between 90 and 240 s;
- B3 nomination 30 s, defense 30 s, Yes/No 15 s, Hunter 20 s;
- B4 the Hunter's turn ends as soon as the shot is taken.

Now fixed in the engine (`PROPOSAL.md` Q11/Q19); the timing settings were removed. **Batches C–E below are still pending.**

*Rejected alternatives: 45 + 15 night split; a flat 3 min discussion; 45 s / 20 s / 20 s; always waiting the full 20 s for the Hunter.*

## Batch C — Moderated games (blocks a *moderated* playtest only)
*Decided separately on 2026-10-16: the moderator may end the match with no winner. The rows below are still pending. The first playtest is automatic mode (2026-10-17), so this batch doesn't block it.*
| # | Question | Recommend | Alternative | Evidence |
|---|---|---|---|---|
| C1 (Q16) ⚠ | Moderator speaks aloud in the app | **Yes, in public** (they narrate) | No; text cues only (today's setting) | They already hear everything (approved); in a room they speak anyway |
| C2 (Q16) | Moderator enters a player's action for them | Yes (in-person play by gesture), within the rules | No | sky2's moderator entered every action |
| C3 (Q16) | Moderator sets the Wolves' target directly | Yes (the pack points, the moderator records it) | Moderator enters each Wolf's pick instead | Same result; faster at a table |
| C4 (Q15/Q26) | Removing a player | Moderator: any time. Host: only after a 2-minute disconnect, and never at night. Removal gives no Hunter shot | Moderator only | A removal at night would reveal a night-time event |
| C5 (Q16) | May the moderator break the rules? | No, never | Free override | Approved rules already can't be bypassed |

## Batch D — Role details (can wait)
| # | Question | Recommend | Alternative | Evidence |
|---|---|---|---|---|
| D1 (Q05) | What the Seer learns | "Wolf" or "not a Wolf", right away | The exact role | sky2 does the same |
| D2 (Q01) | Who may target themselves | Guard yes; Seer no; no self-vote by day; Wolves can't pick a Wolf | Guard can't protect self | Removes pointless or accidental moves |
| D3 (Q02) | Guard protecting the same person twice | Not on two nights in a row; a night with no protection resets this | No restriction | sky2 rule (but sky2 enforced it only in its UI) |
| D4 (Q04) | Guard and Witch | The Guard stops the bite, not poison. Guard + heal on the same person: they live. A heal on someone the Guard also protected is still used up | "Protected twice dies" (a house rule) | sky2 behaviour |
| D5 (Q08) | Wolves picking "nobody" | Allowed; "nobody" wins only if it alone has the most picks; a tie between "nobody" and a player goes to the player | "Nobody" picks are ignored | Keeps one Wolf from blocking the kill |
| D6 (Q10) | May the accused vote in their own Yes/No round? | Yes (they count as living either way) | No | Simpler; the threshold is unchanged |

## Batch E — What players see and order of play (can wait)
| # | Question | Recommend | Alternative | Evidence |
|---|---|---|---|---|
| E1 (Q21) | Dawn announcement | Names only, in seat order, no cause | Show the cause | sky2's order revealed the cause (bites listed first) |
| E2 (Q23) | First phase | Night first, with an attack | No attack on night 1 | Classic play; the setup check already guards against a first-night loss |
| E3 | Second night step when the setup has no Witch | Keep it (the night is always 2 steps, 60 s) | One 60 s step | The setup is public, so either way leaks nothing; two steps keeps one screen flow |
| E4 (Q24 history) | End-of-match recap | Show all roles **and** the full night history | Roles only | Roles at the end are approved; the history is the open part |
| E5 (Q12/Q13) | Death-chain mechanics | Deaths in a batch happen together; Hunters who die together shoot together; victory is checked once the chain ends (and after a removal) | — (follows the approved rules) | Already tested |

## Batch F — A match that can't end — DECIDED 2026-10-16 (option A)
Approved: a **stalemate draw**.
- After 3 consecutive full cycles (night + day) with no gameplay death, the match ends as a draw.
- A warning goes out at the end of the 2nd such day.
- Removal doesn't reset the count.

Now fixed in the engine (`PROPOSAL.md`, approved rules). Evidence that motivated it: with everyone idle, or Wolves picking "nobody" while the village Skips, a 7-player match was still running at day 100.

*Rejected alternatives: a hard day cap; Wolves forced to attack.*
