# Moonveil balance screening — PROVISIONAL (Q17/Q18)

Status: 2026-10-16. **Bots are not players.** This screens for obviously broken setups only; it does not set the role table. Real playtesting decides balance.
Reproduce with `node packages/rules/sim/balance.ts 1000` (deterministic seeds). Rules: `dev` at 013206a (approved rules plus provisional defaults).

## Method
- 1,000 matches per row (500 in the sensitivity rows). Win rates come with Wilson 95% intervals.
- **Match length** sums every step's full duration: nights are 60 s and votes run to their deadline (both approved); the Hunter's turn counts as a full 20 s. It's an upper bound on play time, excluding UI transitions.
- **random** policy: every bot picks uniformly among its legal options. This is a floor that shows the structural bias of the rules.
- **heuristic** policy, explicit assumptions (`sim/bots.ts`, `HEURISTIC_DEFAULTS`):
  - Votes are hidden until close (approved), so bots coordinate only through *public speech*: during discussion everyone accuses someone aloud, and votes follow those accusations.
  - Villagers' suspicion of a real wolf is ×1.5 that of a villager ("social read"). This is a modelling device and one of only two places the bots use hidden information. The other is which wolf counter-claims.
  - Villagers repeat the most-accused player 50% of the time and Skip 10% of the time when no claim guides them.
  - The Seer claims publicly once they've found a wolf; a wolf counter-claims 50% of the time; villagers then trust the real Seer 60% of the time.
  - Wolves act as a perfect bloc: one shared target, and they pile accusations and votes onto the most-accused non-wolf.
  - The Witch always heals the first victim and poisons only a wolf named by a Seer claim she trusts. The Guard protects a claimed Seer.
- **Flag "LOPSIDED"**: the heuristic Village win rate's 95% interval lies entirely outside 35–65%.

## Structural pressure (no bots)
How many wrong executions the Village can afford, assuming one Village death per night, no saves, and every execution missing:

| Players | Recommended deck | Village − Wolves at start | Days before parity if every execution misses | Wolves to find |
|---|---|---|---|---|
| 6 | 2W 1S 0Wi 1G 1H 1V | 2 | 1 | 2 |
| 7 | 2W 1S 1Wi 1G 1H 1V | 3 | 1 | 2 |
| 8 | 2W 1S 1Wi 1G 1H 2V | 4 | 2 | 2 |
| 9 | 2W 1S 1Wi 1G 1H 3V | 5 | 2 | 2 |
| 10 | 3W 1S 1Wi 1G 1H 3V | 4 | 2 | 3 |
| 11 | 3W 1S 1Wi 1G 1H 4V | 5 | 2 | 3 |
| 12 | 3W 1S 1Wi 1G 1H 5V | 6 | 3 | 3 |
| 13 | 4W 1S 1Wi 1G 1H 5V | 5 | 2 | 4 |
| 14 | 4W 1S 1Wi 1G 1H 6V | 6 | 3 | 4 |
| 15 | 4W 1S 1Wi 1G 1H 7V | 7 | 3 | 4 |
| 16 | 5W 1S 1Wi 1G 1H 7V | 6 | 3 | 5 |

Reading: at 6, 7 and 13 players the Village needs every trial to hit a wolf unless the Guard, Witch or Hunter buys time. The approved parity rule is unforgiving at small margins.

## Results
#### Recommended decks and wolf±1 variants (n=1000 per row)

| Players | Deck | Policy | Village win % [95% CI] | Wolves % | Draw % | Exec. hit wolf % | Nights | Minutes p10/p50/p90 | Flag |
|---|---|---|---|---|---|---|---|---|---|
| 6 | **2W 1S 0Wi 1G 1H 1V** | heuristic | 22 [19–24] | 78 | 0 | 40 | 1.7 | 1/5/10 | LOPSIDED |
| 6 | **2W 1S 0Wi 1G 1H 1V** | random | 5 [4–6] | 95 | 0 | 38 | 2.2 | 1/6/12 |  |
| 6 | 1W 1S 0Wi 1G 1H 2V | heuristic | 65 [62–68] | 35 | 0 | 39 | 1.9 | 5/6/10 |  |
| 6 | 3W 1S 0Wi 1G 1H 0V | — | rejected by deck check: wolves must be fewer than village | | | | | | |
| 7 | **2W 1S 1Wi 1G 1H 1V** | heuristic | 43 [40–46] | 57 | 0 | 40 | 2.9 | 10/11/17 |  |
| 7 | **2W 1S 1Wi 1G 1H 1V** | random | 13 [11–15] | 87 | 0 | 34 | 3.5 | 6/13/18 |  |
| 7 | 1W 1S 1Wi 1G 1H 2V | heuristic | 79 [76–81] | 21 | 0 | 37 | 2.2 | 5/10/14 | LOPSIDED |
| 7 | 3W 1S 1Wi 1G 1H 0V | — | rejected by deck check: first night could force a wolf win (parity at first dawn) | | | | | | |
| 8 | **2W 1S 1Wi 1G 1H 2V** | heuristic | 53 [50–56] | 47 | 0 | 38 | 3.3 | 10/15/19 |  |
| 8 | **2W 1S 1Wi 1G 1H 2V** | random | 11 [10–14] | 88 | 0 | 28 | 4.3 | 10/16/22 |  |
| 8 | 1W 1S 1Wi 1G 1H 3V | heuristic | 80 [78–82] | 20 | 0 | 31 | 2.5 | 5/11/18 | LOPSIDED |
| 8 | 3W 1S 1Wi 1G 1H 1V | — | rejected by deck check: first night could force a wolf win (parity at first dawn) | | | | | | |
| 9 | **2W 1S 1Wi 1G 1H 3V** | heuristic | 53 [50–56] | 47 | 0 | 34 | 3.6 | 11/16/22 |  |
| 9 | **2W 1S 1Wi 1G 1H 3V** | random | 15 [13–18] | 85 | 0 | 27 | 5.1 | 12/19/28 |  |
| 9 | 1W 1S 1Wi 1G 1H 4V | heuristic | 80 [77–82] | 20 | 0 | 28 | 2.7 | 6/15/19 | LOPSIDED |
| 9 | 3W 1S 1Wi 1G 1H 2V | heuristic | 19 [17–22] | 81 | 0 | 32 | 3.4 | 11/15/22 | LOPSIDED |
| 10 | **3W 1S 1Wi 1G 1H 3V** | heuristic | 25 [22–28] | 75 | 0 | 32 | 4.0 | 12/20/25 | LOPSIDED |
| 10 | **3W 1S 1Wi 1G 1H 3V** | random | 3 [2–4] | 97 | 0 | 34 | 4.7 | 11/20/28 |  |
| 10 | 2W 1S 1Wi 1G 1H 4V | heuristic | 59 [56–62] | 41 | 0 | 33 | 4.0 | 12/20/25 |  |
| 10 | 4W 1S 1Wi 1G 1H 2V | — | rejected by deck check: first night could force a wolf win (parity at first dawn) | | | | | | |
| 11 | **3W 1S 1Wi 1G 1H 4V** | heuristic | 29 [26–32] | 71 | 0 | 31 | 4.5 | 17/22/28 | LOPSIDED |
| 11 | **3W 1S 1Wi 1G 1H 4V** | random | 4 [3–5] | 96 | 0 | 31 | 5.5 | 16/23/32 |  |
| 11 | 2W 1S 1Wi 1G 1H 5V | heuristic | 56 [53–59] | 44 | 0 | 30 | 4.4 | 16/22/28 |  |
| 11 | 4W 1S 1Wi 1G 1H 3V | heuristic | 4 [3–5] | 96 | 0 | 24 | 3.4 | 12/17/26 | LOPSIDED |
| 12 | **3W 1S 1Wi 1G 1H 5V** | heuristic | 29 [26–32] | 71 | 0 | 28 | 5.0 | 18/26/32 | LOPSIDED |
| 12 | **3W 1S 1Wi 1G 1H 5V** | random | 4 [3–5] | 96 | 0 | 30 | 6.4 | 21/28/38 |  |
| 12 | 2W 1S 1Wi 1G 1H 6V | heuristic | 61 [58–64] | 39 | 0 | 28 | 4.8 | 17/26/31 |  |
| 12 | 4W 1S 1Wi 1G 1H 4V | heuristic | 8 [6–10] | 92 | 0 | 24 | 4.1 | 13/19/29 | LOPSIDED |
| 13 | **4W 1S 1Wi 1G 1H 5V** | heuristic | 10 [8–12] | 90 | 0 | 26 | 4.7 | 18/24/33 | LOPSIDED |
| 13 | **4W 1S 1Wi 1G 1H 5V** | random | 1 [0–1] | 99 | 0 | 35 | 5.7 | 17/27/37 |  |
| 13 | 3W 1S 1Wi 1G 1H 6V | heuristic | 35 [32–38] | 66 | 0 | 28 | 5.5 | 23/28/36 |  |
| 13 | 5W 1S 1Wi 1G 1H 4V | heuristic | 1 [0–2] | 99 | 0 | 23 | 3.3 | 12/14/28 | LOPSIDED |
| 14 | **4W 1S 1Wi 1G 1H 6V** | heuristic | 13 [11–15] | 87 | 0 | 25 | 5.4 | 19/29/38 | LOPSIDED |
| 14 | **4W 1S 1Wi 1G 1H 6V** | random | 1 [0–1] | 99 | 0 | 34 | 6.5 | 23/31/41 |  |
| 14 | 3W 1S 1Wi 1G 1H 7V | heuristic | 40 [37–43] | 60 | 0 | 29 | 6.0 | 24/32/39 |  |
| 14 | 5W 1S 1Wi 1G 1H 5V | heuristic | 2 [1–2] | 99 | 0 | 21 | 4.1 | 14/19/30 | LOPSIDED |
| 15 | **4W 1S 1Wi 1G 1H 7V** | heuristic | 15 [13–18] | 85 | 0 | 24 | 5.9 | 24/30/40 | LOPSIDED |
| 15 | **4W 1S 1Wi 1G 1H 7V** | random | 2 [1–2] | 99 | 0 | 32 | 7.4 | 28/36/46 |  |
| 15 | 3W 1S 1Wi 1G 1H 8V | heuristic | 39 [36–42] | 61 | 0 | 26 | 6.4 | 25/34/41 |  |
| 15 | 5W 1S 1Wi 1G 1H 6V | heuristic | 2 [1–3] | 98 | 0 | 21 | 4.6 | 19/24/35 | LOPSIDED |
| 16 | **5W 1S 1Wi 1G 1H 7V** | heuristic | 3 [2–4] | 97 | 0 | 21 | 5.4 | 20/30/39 | LOPSIDED |
| 16 | **5W 1S 1Wi 1G 1H 7V** | random | 0 [0–1] | 100 | 0 | 37 | 6.6 | 24/33/44 |  |
| 16 | 4W 1S 1Wi 1G 1H 8V | heuristic | 17 [15–19] | 83 | 0 | 24 | 6.5 | 26/35/44 | LOPSIDED |
| 16 | 6W 1S 1Wi 1G 1H 6V | heuristic | 0 [0–1] | 100 | 0 | 20 | 4.0 | 14/20/31 | LOPSIDED |

#### Sensitivity of the recommended decks to the social-read assumption (heuristic, n=500)

| Players | Deck | Policy | Village win % [95% CI] | Wolves % | Draw % | Exec. hit wolf % | Nights | Minutes p10/p50/p90 | Flag |
|---|---|---|---|---|---|---|---|---|---|
| 6 | read=1 | heuristic | 15 [13–19] | 85 | 0 | 32 | 1.7 | 1/5/11 |  |
| 6 | read=2.5 | heuristic | 22 [18–26] | 78 | 0 | 42 | 1.8 | 1/5/11 |  |
| 6 | bandwagon=0.2 | heuristic | 16 [13–19] | 84 | 0 | 34 | 1.8 | 1/5/10 |  |
| 7 | read=1 | heuristic | 34 [30–39] | 66 | 0 | 33 | 2.8 | 6/11/17 |  |
| 7 | read=2.5 | heuristic | 53 [48–57] | 47 | 0 | 47 | 2.9 | 10/11/17 |  |
| 7 | bandwagon=0.2 | heuristic | 43 [39–48] | 57 | 0 | 39 | 3.0 | 10/11/18 |  |
| 8 | read=1 | heuristic | 41 [37–45] | 59 | 0 | 29 | 3.3 | 10/14/19 |  |
| 8 | read=2.5 | heuristic | 59 [54–63] | 41 | 0 | 42 | 3.3 | 10/14/19 |  |
| 8 | bandwagon=0.2 | heuristic | 48 [44–52] | 52 | 0 | 35 | 3.5 | 10/15/20 |  |
| 9 | read=1 | heuristic | 47 [43–52] | 53 | 0 | 31 | 3.8 | 12/16/22 |  |
| 9 | read=2.5 | heuristic | 67 [63–71] | 33 | 0 | 43 | 3.5 | 11/16/21 |  |
| 9 | bandwagon=0.2 | heuristic | 52 [48–57] | 48 | 0 | 33 | 3.8 | 12/16/23 |  |
| 10 | read=1 | heuristic | 17 [14–21] | 83 | 0 | 27 | 3.9 | 12/17/26 |  |
| 10 | read=2.5 | heuristic | 35 [31–39] | 65 | 0 | 37 | 4.1 | 12/20/25 |  |
| 10 | bandwagon=0.2 | heuristic | 19 [16–22] | 81 | 0 | 28 | 4.1 | 12/20/26 |  |
| 12 | read=1 | heuristic | 21 [17–25] | 79 | 0 | 25 | 4.9 | 18/24/32 |  |
| 12 | read=2.5 | heuristic | 47 [42–51] | 53 | 0 | 36 | 4.9 | 18/25/32 |  |
| 12 | bandwagon=0.2 | heuristic | 26 [23–30] | 74 | 0 | 25 | 5.1 | 18/26/33 |  |
| 14 | read=1 | heuristic | 9 [6–11] | 91 | 0 | 23 | 5.3 | 19/28/36 |  |
| 14 | read=2.5 | heuristic | 22 [19–26] | 78 | 0 | 32 | 5.6 | 19/29/38 |  |
| 14 | bandwagon=0.2 | heuristic | 4 [3–7] | 96 | 0 | 19 | 5.3 | 19/28/37 |  |
| 16 | read=1 | heuristic | 1 [0–2] | 99 | 0 | 19 | 5.2 | 20/30/37 |  |
| 16 | read=2.5 | heuristic | 9 [7–12] | 91 | 0 | 26 | 5.7 | 24/31/41 |  |
| 16 | bandwagon=0.2 | heuristic | 1 [0–2] | 99 | 0 | 16 | 5.1 | 20/29/37 |  |

## Findings (screening, not decisions)
1. **7–9 players with 2 wolves look playable.** The heuristic Village win rate is 43–53%, with intervals inside or touching 40–56%. This is the core 7–10 range.
2. **6 players is lopsided either way.** 2 wolves: Village 22% [19–24]. 1 wolf: Village 65% [62–68]. The structural margin is 2 with one day of slack. Consider raising the minimum to 7 (Q18), or playtesting 6 explicitly.
3. **10–16 players look strongly wolf-favoured with the recommended counts.** Village 25% at 10 players, falling to 3% at 16. One wolf fewer gives 59/56/61% at 10/11/12 (2 wolves), 35/40/39% at 13/14/15 (3 wolves), and still 17% at 16 (4 wolves).
4. **Likely bot bias at large tables.** At 13–16 players, the share of executions that hit a wolf falls *below the random-policy rate* (heuristic 21–26% vs random 32–37%; at 7–12 the two are similar). The perfectly coordinated wolf bloc steers a naive village bandwagon, and that effect grows with table size; real players probably do better. Even with a stronger social read (×2.5), the recommended decks reach only 35% at 10 and 9% at 16.
5. **The random policy is wolf-favoured at every size** (Village 0–15%). Uninformed play loses under the approved parity rule. That's expected; it isn't a defect.
6. **Match length** (heuristic, median, upper bound): 7–9 players 11–16 min; 10–12 players 20–26 min; 13–16 players 24–30 min. That's consistent with the 15–30 min estimate in Q19.

## Suggested next step (for the Q17/Q18 decision, provisional)
Playtest candidates; these aren't recommendations to adopt yet:
- 7–9 players: 2 wolves (as now).
- 10–12 players: compare 2 vs 3 wolves.
- 13–15 players: try 3 wolves.
- 16 players: try 4 wolves.
- 6 players: drop support, or playtest 1 vs 2 wolves.

Re-run this screen after any rule decision that affects the night or the vote (for example the Q08 "nobody" rule or Q22 at-close ballots).
