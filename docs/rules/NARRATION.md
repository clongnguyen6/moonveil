# Moonveil narration and phase text

Status: product copy, 2026-10-17. Narration cues are shown by default (D6). They may state **approved rules only**; they must not quietly settle anything that's still pending.
Each line has a **Status**:
- **approved-consistent**: states approved rules only; use as is.
- **pending: X**: depends on an undecided item (codes from `DECISIONS_REMAINING.md`). Use the **neutral** line instead: it's true whatever is decided. Switch to the specific wording only after the item is approved.

Vietnamese is my draft and needs a native read-through. Role names follow sky2 (Sói, Dân làng, Tiên tri, Bảo vệ, Phù thủy, Thợ săn).

## Rules for the copy
- **Public** lines must not depend on hidden state. Every night uses the same lines in the same order, at the same times, even if a role is dead or absent.
- Never say *how* someone died at night, or in what order the night actions happened.
- **Private** lines appear only on that seat's own device, and only while it is entitled to them (a ghost gets no new night prompts).
- Day votes are **open ballots** (approved): who voted for whom is public and live. Night actions stay private.
- Timers, counts and name lists come from the engine (`{t}`, `{mm:ss}`, `{k}`, `{need}`, `{names}`). Durations are approved (Batch B), but timers still come from the engine (pauses, clock).
- `{name}` = seat name; `{n}` = night or day number.

## Match start and roles
| ID | Audience | English | Tiếng Việt | Status |
|---|---|---|---|---|
| S1 | public | The camp settles in for the night. | Cả trại đã yên giấc. | pending: **E2** (night first). Neutral: "The match begins." / "Ván đấu bắt đầu." |
| S2 | private | You are the **{role}**. {one-line role summary} | Bạn là **{role}**. {tóm tắt vai} | pending: **D1–D5** for Seer, Guard and Wolf details in the summary. Neutral: "You are the **{role}**." / "Bạn là **{role}**." plus approved-only summaries: Witch (one heal, one poison, both usable in one night; self-heal yes, self-poison no; sees the victim only while the heal is unused); Hunter (when you die in play, you get 20 s to shoot); Villager (no night power) |
| S3 | private (wolves) | Your pack: {names}. | Bầy của bạn: {names}. | approved-consistent |

## Night (always the same public sequence; 60 s in total)
| ID | Audience | English | Tiếng Việt | Status |
|---|---|---|---|---|
| N1 | public | Night {n}. Everyone close your eyes. | Đêm {n}. Mọi người nhắm mắt. | approved-consistent |
| N2 | private (living wolves) | Choose tonight's prey with your pack. The most-picked target is attacked; a tie is decided at random. | Cùng bầy chọn con mồi. Ai bị chọn nhiều nhất sẽ bị cắn; nếu hòa thì chọn ngẫu nhiên. | approved-consistent (Q07). Show only when the engine offers the pick action (night 1 attack is **E2**) |
| N3 | private (living wolves) | {name} picked {target}. | {name} chọn {target}. | approved-consistent |
| N4 | private (Seer) | Choose someone to look into. | Chọn một người để soi. | approved-consistent (the menu lists only legal targets) |
| N5 | private (Seer) | {name} **is a Wolf**. / {name} **is not a Wolf**. | {name} **là Sói**. / {name} **không phải Sói**. | pending: **D1** (what the Seer learns). Neutral: "Your result for {name}: **{result}**." / "Kết quả soi {name}: **{result}**." with `{result}` taken from the engine |
| N6 | private (Guard) | Choose someone to protect tonight (not the same person as last night). | Chọn một người để bảo vệ đêm nay (không trùng người đêm qua). | pending: **D2/D3** (self, repeats). Neutral: "Choose someone to protect tonight." / "Chọn một người để bảo vệ đêm nay." (the menu lists only legal targets) |
| N7 | public | The night deepens… | Màn đêm càng sâu… | pending: **E3** (second step in setups without a Witch). Neutral: "The night goes on…" / "Đêm vẫn tiếp diễn…", shown at the halfway mark, not tied to a step |
| N8 | private (Witch, heal unused) | The wolves attacked **{name}**. Use your healing potion? | Sói đã cắn **{name}**. Dùng bình cứu? | approved-consistent (Q03) |
| N9 | private (Witch, heal unused) | Nobody was attacked tonight. | Đêm nay không ai bị cắn. | approved-consistent (Q03) |
| N10 | private (Witch) | Use your poison on someone? | Dùng bình độc lên ai đó? | approved-consistent (Q03) |
| N11 | private (Witch, heal spent) | Your healing potion is used up. | Bạn đã dùng bình cứu. | approved-consistent (Q03) |
| N12 | private (any night role) | {t} seconds left. | Còn {t} giây. | approved-consistent (`{t}` from the engine) |

## Dawn and the Hunter
| ID | Audience | English | Tiếng Việt | Status |
|---|---|---|---|---|
| D1 | public | Morning. **{names}** did not survive the night. | Trời sáng. **{names}** đã không qua khỏi đêm qua. | approved-consistent: the wording says nothing about causes (**E1** decides only whether causes are added). List names in the engine's order |
| D2 | public | Morning. Everyone survived the night. | Trời sáng. Đêm qua không ai thiệt mạng. | approved-consistent |
| H1 | public | **{name} was the Hunter.** They have up to 20 seconds for a final shot. | **{name} là Thợ săn.** Có tối đa 20 giây để bắn phát cuối. | approved-consistent (B3 20 s; B4 the turn ends once the shot is taken, hence "up to") |
| H2 | private (Hunter) | Choose someone to shoot, or hold your fire. | Chọn người để bắn, hoặc không bắn. | approved-consistent |
| H3 | public | {hunter} shot **{target}**. | {hunter} đã bắn **{target}**. | approved-consistent |
| H4 | public | {hunter} held their fire. | {hunter} đã không bắn. | approved-consistent (pass or timeout) |

## Day
| ID | Audience | English | Tiếng Việt | Status |
|---|---|---|---|---|
| Y1 | public | Day {n}. Talk it over: {mm:ss}. | Ngày {n}. Thảo luận: {mm:ss}. | approved-consistent (`{mm:ss}` from the engine; length approved, B2) |
| Y2 | public | Vote for who goes on trial, or Skip. Everyone sees each vote as it's cast. | Bỏ phiếu đưa ai ra xét xử, hoặc Bỏ qua. Mọi người đều thấy từng phiếu ngay khi bỏ. | approved-consistent (Q09, open ballots) |
| Y3 | public (live) | {voter} → {name} / {voter} → Skip / {voter}: Yes / {voter}: No | {voter} → {name} / {voter} → Bỏ qua / {voter}: Đồng ý / {voter}: Không | approved-consistent |
| Y3b | private (voter) | You can change your vote until time is up. | Bạn có thể đổi phiếu đến khi hết giờ. | approved-consistent |
| Y4 | public | **{name}** goes on trial ({k} votes). | **{name}** bị đưa ra xét xử ({k} phiếu). | approved-consistent |
| Y5 | public | No trial today: the vote was tied. | Hôm nay không xét xử: số phiếu hòa. | approved-consistent |
| Y6 | public | No trial today: Skip had the most votes. | Hôm nay không xét xử: Bỏ qua nhiều phiếu nhất. | approved-consistent |
| Y7 | public | No trial today: nobody voted. | Hôm nay không xét xử: không ai bỏ phiếu. | approved-consistent |
| Y8 | public | {name}, you have 30 seconds to defend yourself. Everyone else listens. | {name}, bạn có 30 giây để tự bào chữa. Mọi người lắng nghe. | approved-consistent (30 s defense; only the accused speaks) |
| Y9 | public | Execute {name}? It takes Yes from more than half of all living players: **{need} of {living}**. | Xử tử {name}? Cần hơn một nửa số người còn sống đồng ý: **{need}/{living}**. | approved-consistent (whether the accused votes is **D6**; the line doesn't say) |
| Y10 | public | **{name}** is executed ({yes} Yes). | **{name}** bị xử tử ({yes} phiếu đồng ý). | approved-consistent |
| Y11 | public | {name} is spared ({yes} Yes; {need} needed). | {name} được tha ({yes} phiếu đồng ý; cần {need}). | approved-consistent |
| Y12 | public | The moderator counted {yes} Yes. | Quản trò đếm được {yes} phiếu đồng ý. | approved-consistent |
| Y13 | public, at close | Final votes: {voter → choice list}. | Phiếu cuối: {danh sách}. | approved-consistent |

`{need}` = ⌊living ÷ 2⌋ + 1.

## Ghosts, endings, connection
| ID | Audience | English | Tiếng Việt | Status |
|---|---|---|---|---|
| G1 | private (new ghost) | You have died. Talk with the other ghosts and listen to the village; the living can't hear you. | Bạn đã chết. Bạn có thể nói chuyện với các hồn ma khác và nghe dân làng; người sống không nghe thấy bạn. | approved-consistent |
| G2 | private (pending Hunter) | Take your shot first; the ghosts will wait. | Hãy bắn trước đã; các hồn ma sẽ đợi. | approved-consistent |
| E1 | public | The wolves are now at least as many as everyone else alive. **The wolves win.** | Số Sói đã ít nhất bằng tất cả những người còn sống khác. **Sói thắng.** | approved-consistent (corrected 2026-10-17: was "equal the rest of the village") |
| E2 | public | The last wolf is gone. **The village wins.** | Con Sói cuối cùng đã bị loại. **Dân làng thắng.** | approved-consistent |
| E3 | public | Nobody is left standing. **It's a draw.** | Không còn ai sống sót. **Hòa.** | approved-consistent |
| E3b | public (event `stalemateWarning`, end of the 2nd no-death day) | If nobody dies before the end of the next day, the match ends in a draw. | Nếu không ai chết trước khi hết ngày mai, ván đấu sẽ hòa. | approved-consistent |
| E3c | public | Three full days and nights without a death. **It's a draw.** | Ba ngày đêm liền không ai chết. **Hòa.** | approved-consistent |
| E3d | public | The moderator ended the match. No winner. | Quản trò đã kết thúc ván. Không có người thắng. | approved-consistent |
| E4 | public | All roles are revealed. | Tất cả vai trò được công khai. | approved-consistent (the night history is **E4** in the decisions page; this line doesn't mention it) |
| C1 | reconnecting player | Welcome back. You're still in the game. | Chào mừng trở lại. Bạn vẫn đang trong trận. | approved-consistent |
| C2 | anyone connected while paused (moderator, spectator) | All players are offline. The game is paused. | Mọi người chơi đều mất kết nối. Trận đấu tạm dừng. | approved-consistent |
| C3 | public | The game resumes. | Trận đấu tiếp tục. | approved-consistent |
| C4 | public | {name} has left the game. | {name} đã rời trận. | pending: **C4** (removal powers). The wording is neutral: show it only when the engine reports a removal |

## Moderator cues (moderator mode; shown by default)
| ID | English | Tiếng Việt | Status |
|---|---|---|---|
| M1 | Close this step when everyone has acted. | Đóng bước này khi mọi người đã hành động xong. | approved-consistent |
| M2 | Count the hands for Yes and enter the number. | Đếm số tay giơ đồng ý và nhập con số. | approved-consistent (moderator Yes count) |
| M3 | Ending the match now gives no winner and reveals all roles. | Kết thúc ván lúc này sẽ không có người thắng và mọi vai trò được công khai. | approved-consistent (moderator end) |
