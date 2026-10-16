# Moonveil balance screening — PROVISIONAL (Q17/Q18)

Status: 2026-10-16. **Decided since:** Batch A (7–15 players; 2 Wolves at 7–12, 3 at 13–15). The 6- and 16-player rows below are historical. **Bots are not players.** This screens for obviously broken setups only; it does not set the role table. Real playtesting decides balance.
Reproduce with `node packages/rules/sim/balance.ts 1000` (deterministic seeds). Rules: `rules-8` (f6d0836): approved rules including **open day ballots**, plus provisional defaults. Earlier hidden-ballot results are superseded.

## Method
- 1,000 matches per row (500 in the sensitivity rows). Win rates come with Wilson 95% intervals.
- **Match length** sums every step's full duration: nights are 60 s and votes run to their deadline (both approved); the Hunter's turn counts as a full 20 s. It's an upper bound on play time, excluding UI transitions.
- **random** policy: every bot picks uniformly among its legal options. This is a floor that shows the structural bias of the rules.
- **heuristic** policy, explicit assumptions (`sim/bots.ts`, `HEURISTIC_DEFAULTS`):
  - Day votes are open and live (approved). Bots coordinate through *public speech* (during discussion everyone accuses someone aloud) and through the *live ballots*: a villager with no claim to follow joins the current vote leader 40% of the time (`followLiveVotes`); wolves pile onto the live leading non-wolf.
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

## Results (open ballots)
#### Recommended decks and wolf±1 variants (n=1000 per row)

| Players | Deck | Policy | Village win % [95% CI] | Wolves % | Draw % | Exec. hit wolf % | Nights | Minutes p10/p50/p90 | Flag |
|---|---|---|---|---|---|---|---|---|---|
| 6 | **2W 1S 0Wi 1G 1H 1V** | heuristic | 21 [18–23] | 79 | 0 | 37 | 1.7 | 1/6/11 | LOPSIDED |
| 6 | **2W 1S 0Wi 1G 1H 1V** | random | 5 [4–6] | 95 | 0 | 38 | 2.2 | 1/6/12 |  |
| 6 | 1W 1S 0Wi 1G 1H 2V | heuristic | 65 [62–68] | 35 | 0 | 37 | 1.9 | 5/6/10 |  |
| 6 | 3W 1S 0Wi 1G 1H 0V | — | rejected by deck check: wolves must be fewer than village | | | | | | |
| 7 | **2W 1S 1Wi 1G 1H 1V** | heuristic | 42 [39–45] | 58 | 0 | 38 | 2.8 | 6/11/17 |  |
| 7 | **2W 1S 1Wi 1G 1H 1V** | random | 13 [11–15] | 87 | 0 | 34 | 3.5 | 6/13/18 |  |
| 7 | 1W 1S 1Wi 1G 1H 2V | heuristic | 75 [72–77] | 25 | 0 | 33 | 2.2 | 5/10/14 | LOPSIDED |
| 7 | 3W 1S 1Wi 1G 1H 0V | — | rejected by deck check: first night could force a wolf win (parity at first dawn) | | | | | | |
| 8 | **2W 1S 1Wi 1G 1H 2V** | heuristic | 49 [45–52] | 52 | 0 | 36 | 3.3 | 10/14/19 |  |
| 8 | **2W 1S 1Wi 1G 1H 2V** | random | 11 [10–14] | 88 | 0 | 28 | 4.3 | 10/16/22 |  |
| 8 | 1W 1S 1Wi 1G 1H 3V | heuristic | 79 [76–81] | 21 | 0 | 31 | 2.5 | 5/10/18 | LOPSIDED |
| 8 | 3W 1S 1Wi 1G 1H 1V | — | rejected by deck check: first night could force a wolf win (parity at first dawn) | | | | | | |
| 9 | **2W 1S 1Wi 1G 1H 3V** | heuristic | 50 [47–53] | 50 | 0 | 32 | 3.7 | 11/16/22 |  |
| 9 | **2W 1S 1Wi 1G 1H 3V** | random | 15 [13–18] | 85 | 0 | 27 | 5.1 | 12/19/28 |  |
| 9 | 1W 1S 1Wi 1G 1H 4V | heuristic | 78 [75–80] | 22 | 0 | 28 | 2.8 | 6/15/20 | LOPSIDED |
| 9 | 3W 1S 1Wi 1G 1H 2V | heuristic | 18 [15–20] | 82 | 0 | 31 | 3.3 | 11/15/22 | LOPSIDED |
| 10 | **3W 1S 1Wi 1G 1H 3V** | heuristic | 22 [20–25] | 78 | 0 | 29 | 3.9 | 12/17/25 | LOPSIDED |
| 10 | **3W 1S 1Wi 1G 1H 3V** | random | 3 [2–4] | 97 | 0 | 34 | 4.7 | 11/20/28 |  |
| 10 | 2W 1S 1Wi 1G 1H 4V | heuristic | 55 [52–58] | 45 | 0 | 31 | 4.0 | 15/20/25 |  |
| 10 | 4W 1S 1Wi 1G 1H 2V | — | rejected by deck check: first night could force a wolf win (parity at first dawn) | | | | | | |
| 11 | **3W 1S 1Wi 1G 1H 4V** | heuristic | 22 [20–25] | 78 | 0 | 27 | 4.4 | 17/21/28 | LOPSIDED |
| 11 | **3W 1S 1Wi 1G 1H 4V** | random | 4 [3–5] | 96 | 0 | 31 | 5.5 | 16/23/32 |  |
| 11 | 2W 1S 1Wi 1G 1H 5V | heuristic | 57 [54–60] | 43 | 0 | 29 | 4.4 | 16/22/28 |  |
| 11 | 4W 1S 1Wi 1G 1H 3V | heuristic | 4 [3–5] | 96 | 0 | 24 | 3.4 | 12/16/26 | LOPSIDED |
| 12 | **3W 1S 1Wi 1G 1H 5V** | heuristic | 27 [25–30] | 73 | 0 | 26 | 4.9 | 18/25/32 | LOPSIDED |
| 12 | **3W 1S 1Wi 1G 1H 5V** | random | 4 [3–5] | 96 | 0 | 30 | 6.4 | 21/28/38 |  |
| 12 | 2W 1S 1Wi 1G 1H 6V | heuristic | 57 [54–60] | 43 | 0 | 26 | 4.8 | 18/26/31 |  |
| 12 | 4W 1S 1Wi 1G 1H 4V | heuristic | 6 [5–8] | 94 | 0 | 24 | 4.0 | 13/19/29 | LOPSIDED |
| 13 | **4W 1S 1Wi 1G 1H 5V** | heuristic | 8 [7–10] | 92 | 0 | 24 | 4.7 | 18/24/33 | LOPSIDED |
| 13 | **4W 1S 1Wi 1G 1H 5V** | random | 1 [0–1] | 99 | 0 | 35 | 5.7 | 17/27/37 |  |
| 13 | 3W 1S 1Wi 1G 1H 6V | heuristic | 27 [24–30] | 73 | 0 | 26 | 5.4 | 22/28/36 | LOPSIDED |
| 13 | 5W 1S 1Wi 1G 1H 4V | heuristic | 1 [0–2] | 99 | 0 | 24 | 3.3 | 12/18/28 | LOPSIDED |
| 14 | **4W 1S 1Wi 1G 1H 6V** | heuristic | 10 [8–12] | 90 | 0 | 22 | 5.2 | 19/28/36 | LOPSIDED |
| 14 | **4W 1S 1Wi 1G 1H 6V** | random | 1 [0–1] | 99 | 0 | 34 | 6.5 | 23/31/41 |  |
| 14 | 3W 1S 1Wi 1G 1H 7V | heuristic | 34 [31–37] | 66 | 0 | 26 | 5.9 | 24/32/39 |  |
| 14 | 5W 1S 1Wi 1G 1H 5V | heuristic | 1 [0–1] | 100 | 0 | 20 | 4.0 | 14/19/30 | LOPSIDED |
| 15 | **4W 1S 1Wi 1G 1H 7V** | heuristic | 9 [7–11] | 91 | 0 | 21 | 5.8 | 24/30/40 | LOPSIDED |
| 15 | **4W 1S 1Wi 1G 1H 7V** | random | 2 [1–2] | 99 | 0 | 32 | 7.4 | 28/36/46 |  |
| 15 | 3W 1S 1Wi 1G 1H 8V | heuristic | 31 [28–34] | 69 | 0 | 23 | 6.4 | 25/34/42 | LOPSIDED |
| 15 | 5W 1S 1Wi 1G 1H 6V | heuristic | 1 [1–2] | 99 | 0 | 19 | 4.5 | 19/24/34 | LOPSIDED |
| 16 | **5W 1S 1Wi 1G 1H 7V** | heuristic | 3 [2–4] | 97 | 0 | 19 | 5.2 | 20/29/37 | LOPSIDED |
| 16 | **5W 1S 1Wi 1G 1H 7V** | random | 0 [0–1] | 100 | 0 | 37 | 6.6 | 24/33/44 |  |
| 16 | 4W 1S 1Wi 1G 1H 8V | heuristic | 12 [10–14] | 88 | 0 | 21 | 6.3 | 26/35/44 | LOPSIDED |
| 16 | 6W 1S 1Wi 1G 1H 6V | heuristic | 0 [0–0] | 100 | 0 | 19 | 3.9 | 14/20/31 | LOPSIDED |

#### Sensitivity of the recommended decks to the social-read assumption (heuristic, n=500)

| Players | Deck | Policy | Village win % [95% CI] | Wolves % | Draw % | Exec. hit wolf % | Nights | Minutes p10/p50/p90 | Flag |
|---|---|---|---|---|---|---|---|---|---|
| 6 | read=1 | heuristic | 15 [12–18] | 85 | 0 | 31 | 1.7 | 1/5/10 |  |
| 6 | read=2.5 | heuristic | 23 [20–27] | 77 | 0 | 40 | 1.7 | 1/6/11 |  |
| 6 | bandwagon=0.2 | heuristic | 17 [14–20] | 83 | 0 | 33 | 1.7 | 1/5/10 |  |
| 6 | followLive=0 | heuristic | 19 [16–23] | 81 | 0 | 37 | 1.8 | 1/6/11 |  |
| 7 | read=1 | heuristic | 35 [31–39] | 65 | 0 | 33 | 2.8 | 10/11/18 |  |
| 7 | read=2.5 | heuristic | 51 [46–55] | 49 | 0 | 45 | 2.8 | 10/11/17 |  |
| 7 | bandwagon=0.2 | heuristic | 38 [34–43] | 62 | 0 | 35 | 2.9 | 9/11/18 |  |
| 7 | followLive=0 | heuristic | 42 [38–47] | 58 | 0 | 38 | 2.9 | 10/11/17 |  |
| 8 | read=1 | heuristic | 40 [36–45] | 60 | 0 | 31 | 3.3 | 10/14/19 |  |
| 8 | read=2.5 | heuristic | 61 [56–65] | 39 | 0 | 43 | 3.3 | 10/15/19 |  |
| 8 | bandwagon=0.2 | heuristic | 43 [39–48] | 57 | 0 | 34 | 3.4 | 10/15/19 |  |
| 8 | followLive=0 | heuristic | 50 [45–54] | 50 | 0 | 36 | 3.3 | 10/14/19 |  |
| 9 | read=1 | heuristic | 41 [37–45] | 59 | 0 | 28 | 3.7 | 12/16/21 |  |
| 9 | read=2.5 | heuristic | 65 [61–69] | 35 | 0 | 41 | 3.5 | 11/16/21 |  |
| 9 | bandwagon=0.2 | heuristic | 53 [49–57] | 47 | 0 | 34 | 3.7 | 11/16/22 |  |
| 9 | followLive=0 | heuristic | 52 [48–57] | 48 | 0 | 34 | 3.8 | 11/16/23 |  |
| 10 | read=1 | heuristic | 15 [12–19] | 85 | 0 | 25 | 3.9 | 12/17/25 |  |
| 10 | read=2.5 | heuristic | 31 [27–35] | 69 | 0 | 35 | 4.1 | 12/20/25 |  |
| 10 | bandwagon=0.2 | heuristic | 18 [15–22] | 82 | 0 | 27 | 4.0 | 12/18/26 |  |
| 10 | followLive=0 | heuristic | 25 [21–29] | 75 | 0 | 32 | 4.0 | 12/20/25 |  |
| 12 | read=1 | heuristic | 20 [17–24] | 80 | 0 | 23 | 4.9 | 18/24/32 |  |
| 12 | read=2.5 | heuristic | 40 [36–44] | 60 | 0 | 32 | 4.9 | 18/24/32 |  |
| 12 | bandwagon=0.2 | heuristic | 22 [19–26] | 78 | 0 | 24 | 4.9 | 18/24/32 |  |
| 12 | followLive=0 | heuristic | 27 [23–31] | 73 | 0 | 28 | 5.1 | 18/26/32 |  |
| 14 | read=1 | heuristic | 5 [3–7] | 95 | 0 | 19 | 5.0 | 19/25/35 |  |
| 14 | read=2.5 | heuristic | 20 [16–23] | 80 | 0 | 29 | 5.4 | 19/29/38 |  |
| 14 | bandwagon=0.2 | heuristic | 7 [5–10] | 93 | 0 | 20 | 5.2 | 19/28/36 |  |
| 14 | followLive=0 | heuristic | 10 [8–13] | 90 | 0 | 23 | 5.3 | 19/28/37 |  |
| 16 | read=1 | heuristic | 1 [1–3] | 99 | 0 | 18 | 5.0 | 20/29/36 |  |
| 16 | read=2.5 | heuristic | 5 [3–7] | 95 | 0 | 22 | 5.4 | 20/30/40 |  |
| 16 | bandwagon=0.2 | heuristic | 2 [1–4] | 98 | 0 | 17 | 5.1 | 20/29/37 |  |
| 16 | followLive=0 | heuristic | 4 [2–6] | 96 | 0 | 21 | 5.3 | 20/30/40 |  |

## Findings (screening, not decisions)
1. **7–9 players with 2 wolves look playable.** The heuristic Village win rate is 42% [39–45], 49% [45–52] and 50% [47–53].
2. **6 players is lopsided either way.** 2 wolves: Village 21% [18–23]. 1 wolf: 65% [62–68]. The structural margin is 2, with one day of slack. Consider a minimum of 7 (Q18), or playtest 6 explicitly.
3. **10–16 players with the recommended wolf counts look strongly wolf-favoured.** Village 22–27% at 10–12 players and 3–10% at 13–16. With one wolf fewer: 55–57% at 10–12 (2 wolves), 27–34% at 13–15 (3 wolves), and 12% at 16 (4 wolves).
4. **Following the live ballots has little effect in this model.** With it off, Village is 25% vs 22% at 10 players, 27% vs 27% at 12, 10% vs 10% at 14 and 4% vs 3% at 16. Those differences are within noise: the comparison rows use different seeds and half the sample. Compared with the earlier hidden-ballot run, results moved by at most a few points.
5. **Likely bot bias at large tables.** At 13–16 players, the share of executions that hit a wolf (19–24%) is below the random-policy rate (32–37%). The perfectly coordinated wolf bloc is unrealistic; real players probably do better. Even with a strong social read (×2.5), the recommended decks reach only 31% at 10 and 5% at 16.
6. **The random policy is wolf-favoured at every size** (Village 0–15%). That's expected under the approved parity rule.
7. **Match length** (heuristic, median, upper bound): 11–16 min at 7–9 players, 20–26 min at 10–12, 24–30 min at 13–16. That fits the Q19 estimate.

## Suggested next step (for the Q17/Q18 decision, provisional)
Playtest candidates; these aren't recommendations to adopt yet:
- 7–9 players: 2 wolves (as now).
- 10–12 players: 2 wolves, possibly compared against 3.
- 13–15 players: 3 wolves.
- 16 players: 4 wolves, which likely still needs help, such as two Guards or Seers (Q17 limits).
- 6 players: drop support, or playtest 1 vs 2 wolves.

Re-run this screen after any decision that affects the night or the vote (for example the Q08 "nobody" rule).
