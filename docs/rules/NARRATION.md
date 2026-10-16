# Moonveil narration and phase text — DRAFT (provisional)

Status: **draft product copy, 2026-10-16. Nothing here is approved.** Rule references point to `PROPOSAL.md`: ✅ = the line follows an approved rule; 🟡 = it follows a provisional rule and must change if that rule changes.
Vietnamese is my draft and needs a native read-through. Role names follow sky2 (Sói, Dân làng, Tiên tri, Bảo vệ, Phù thủy, Thợ săn).

## Rules for the copy (secrecy)
- **Public** lines must not depend on hidden state. Every night uses the same lines in the same order, at the same times, even if a role is dead or absent.
- Never say *how* someone died at night, or in what order the night actions happened.
- **Private** lines appear only on that seat's own device, and only while it is entitled to them (a ghost gets no new night prompts).
- Vote lines don't show running totals or other people's choices until the vote closes.
- `{name}` = seat name; `{n}` = night or day number; `{t}` = seconds.

## Match start and roles
| ID | Audience | English | Tiếng Việt | Rule |
|---|---|---|---|---|
| S1 | public | The camp settles in for the night. | Cả trại đã yên giấc. | — |
| S2 | private | You are the **{role}**. {one-line role summary} | Bạn là **{role}**. {tóm tắt vai} | ✅ six roles |
| S3 | private (wolves) | Your pack: {names}. | Bầy của bạn: {names}. | ✅ |

## Night (always the same public sequence; 60 s in total)
| ID | Audience | English | Tiếng Việt | Rule |
|---|---|---|---|---|
| N1 | public | Night {n}. Everyone close your eyes. | Đêm {n}. Mọi người nhắm mắt. | ✅ Q11 |
| N2 | private (living wolves) | Choose tonight's prey with your pack. The most-picked target is attacked; a tie is decided at random. | Cùng bầy chọn con mồi. Ai bị chọn nhiều nhất sẽ bị cắn; nếu hòa thì chọn ngẫu nhiên. | ✅ Q07 |
| N3 | private (living wolves) | {name} picked {target}. | {name} chọn {target}. | ✅ Q07 |
| N4 | private (Seer) | Choose someone to look into. | Chọn một người để soi. | 🟡 Q05 |
| N5 | private (Seer) | {name} **is a Wolf**. / {name} **is not a Wolf**. | {name} **là Sói**. / {name} **không phải Sói**. | 🟡 Q05 |
| N6 | private (Guard) | Choose someone to protect tonight (not the same person as last night). | Chọn một người để bảo vệ đêm nay (không trùng người đêm qua). | 🟡 Q01/Q02 |
| N7 | public | The night deepens… | Màn đêm càng sâu… | ✅ Q11 (the second step always runs) |
| N8 | private (Witch, heal unused) | The wolves attacked **{name}**. Use your healing potion? | Sói đã cắn **{name}**. Dùng bình cứu? | ✅ Q03 |
| N9 | private (Witch, heal unused) | Nobody was attacked tonight. | Đêm nay không ai bị cắn. | ✅ Q03 |
| N10 | private (Witch) | Use your poison on someone? | Dùng bình độc lên ai đó? | ✅ Q03 |
| N11 | private (Witch, heal spent) | Your healing potion is used up. | Bạn đã dùng bình cứu. | ✅ Q03 |
| N12 | private (any night role) | {t} seconds left. | Còn {t} giây. | ✅ Q11 |

## Dawn and the Hunter
| ID | Audience | English | Tiếng Việt | Rule |
|---|---|---|---|---|
| D1 | public | Morning. **{names}** did not survive the night. | Trời sáng. **{names}** đã không qua khỏi đêm qua. | 🟡 Q21 (names only, sorted by seat) |
| D2 | public | Morning. Everyone survived the night. | Trời sáng. Đêm qua không ai thiệt mạng. | 🟡 Q21 |
| H1 | public | **{name} was the Hunter.** They have 20 seconds for a final shot. | **{name} là Thợ săn.** Có 20 giây để bắn phát cuối. | ✅ Q06/Q20 |
| H2 | private (Hunter) | Choose someone to shoot, or hold your fire. | Chọn người để bắn, hoặc không bắn. | ✅ Q06 |
| H3 | public | {hunter} shot **{target}**. | {hunter} đã bắn **{target}**. | ✅ Q06 |
| H4 | public | {hunter} held their fire. | {hunter} đã không bắn. | ✅ Q06 |

## Day
| ID | Audience | English | Tiếng Việt | Rule |
|---|---|---|---|---|
| Y1 | public | Day {n}. Talk it over: {mm:ss}. | Ngày {n}. Thảo luận: {mm:ss}. | 🟡 Q19 durations |
| Y2 | public | Vote for who goes on trial, or Skip. Votes stay hidden until time is up. | Bỏ phiếu đưa ai ra xét xử, hoặc Bỏ qua. Phiếu được giữ kín đến khi hết giờ. | ✅ Q09, ✅ day votes |
| Y3 | private (voter) | Your vote: {name}. You can change it until time is up. | Bạn đã chọn: {name}. Có thể đổi đến khi hết giờ. | ✅ day votes |
| Y4 | public | **{name}** goes on trial ({k} votes). | **{name}** bị đưa ra xét xử ({k} phiếu). | ✅ Q09 |
| Y5 | public | No trial today: the vote was tied. | Hôm nay không xét xử: số phiếu hòa. | ✅ Q09 |
| Y6 | public | No trial today: Skip had the most votes. | Hôm nay không xét xử: Bỏ qua nhiều phiếu nhất. | ✅ Q09 |
| Y7 | public | No trial today: nobody voted. | Hôm nay không xét xử: không ai bỏ phiếu. | ✅ Q09 |
| Y8 | public | {name}, you have 30 seconds to defend yourself. Everyone else listens. | {name}, bạn có 30 giây để tự bào chữa. Mọi người lắng nghe. | ✅ Q10, ✅ Q25 |
| Y9 | public | Execute {name}? It takes Yes from more than half of all living players: **{need} of {living}**. | Xử tử {name}? Cần hơn một nửa số người còn sống đồng ý: **{need}/{living}**. | ✅ Q10 threshold |
| Y10 | public | **{name}** is executed ({yes} Yes). | **{name}** bị xử tử ({yes} phiếu đồng ý). | ✅ Q10 |
| Y11 | public | {name} is spared ({yes} Yes; {need} needed). | {name} được tha ({yes} phiếu đồng ý; cần {need}). | ✅ Q10 |
| Y12 | public | The moderator counted {yes} Yes. | Quản trò đếm được {yes} phiếu đồng ý. | ✅ Q16 Yes count |
| Y13 | public, at close | Votes: {voter → choice list} | Phiếu: {danh sách} | 🟡 Q22 (ballots shown at close) |

`{need}` = ⌊living ÷ 2⌋ + 1.

## Ghosts, endings, connection
| ID | Audience | English | Tiếng Việt | Rule |
|---|---|---|---|---|
| G1 | private (new ghost) | You have died. Talk with the other ghosts and listen to the village; the living can't hear you. | Bạn đã chết. Bạn có thể nói chuyện với các hồn ma khác và nghe dân làng; người sống không nghe thấy bạn. | ✅ Q24/Q25 |
| G2 | private (pending Hunter) | Take your shot first; the ghosts will wait. | Hãy bắn trước đã; các hồn ma sẽ đợi. | ✅ Q06 |
| E1 | public | The wolves now equal the rest of the village. **The wolves win.** | Số Sói đã bằng số dân còn lại. **Sói thắng.** | ✅ victory |
| E2 | public | The last wolf is gone. **The village wins.** | Con Sói cuối cùng đã bị loại. **Dân làng thắng.** | ✅ victory |
| E3 | public | Nobody is left standing. **It's a draw.** | Không còn ai sống sót. **Hòa.** | ✅ Q14 |
| E4 | public | All roles are revealed. | Tất cả vai trò được công khai. | ✅ Q20 |
| C1 | reconnecting player | Welcome back. You're still in the game. | Chào mừng trở lại. Bạn vẫn đang trong trận. | ✅ disconnects |
| C2 | anyone connected while paused (moderator, spectator) | All players are offline. The game is paused. | Mọi người chơi đều mất kết nối. Trận đấu tạm dừng. | ✅ pause |
| C3 | public | The game resumes. | Trận đấu tiếp tục. | ✅ pause |
| C4 | public | {name} has left the game. | {name} đã rời trận. | 🟡 Q15/Q26 removal |
