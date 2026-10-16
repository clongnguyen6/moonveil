// Tiếng Việt. Cùng khóa với en.ts.
import type { Strings } from './en.ts';
export const vi: Strings = {
  app: 'Moonveil',
  ok: 'OK', cancel: 'Hủy', confirm: 'Xác nhận', pass: 'Bỏ qua', skip: 'Không ai', done: 'Xong', back: 'Quay lại', close: 'Đóng',
  send: 'Gửi', copy: 'Sao chép', copied: 'Đã chép', you: 'bạn', host: 'chủ phòng', moderator: 'Quản trò', online: 'trực tuyến', offline: 'mất kết nối',
  ready: 'Sẵn sàng', notReady: 'Chưa sẵn sàng', leave: 'Rời phòng', help: 'Trợ giúp', settings: 'Cài đặt', chat: 'Chat', roleCard: 'Vai của tôi',
  language: 'Ngôn ngữ', sound: 'Âm báo', on: 'Bật', off: 'Tắt', motion: 'Hiệu ứng', motionSystem: 'Theo thiết bị', motionReduce: 'Giảm', motionFull: 'Đầy đủ',
  change: 'Đổi', waiting: 'Đang chờ…', seconds: '{s} giây',

  connConnected: 'Đã kết nối', connReconnecting: 'Đang kết nối lại…', connReconnectHint: 'Ghế của bạn vẫn giữ. Ván chơi vẫn tiếp tục.',
  connReplaced: 'Đã mở ở tab khác.', connUseHere: 'Dùng ở đây', connEnded: 'Bạn đã rời phòng.', connOffline: 'Ngoại tuyến',

  entryTagline: 'Ma Sói bên lửa trại. Mỗi người một điện thoại, nói chuyện ngay trong game.',
  entryName: 'Tên của bạn', entryNamePh: 'vd: Linh', entryLook: 'Diện mạo', entryColour: 'Màu', entryHat: 'Mũ',
  entryCode: 'Mã phòng', entryJoin: 'Vào phòng', entryOr: 'hoặc tạo phòng mới', entryCreateAuto: 'Tạo & chơi', entryCreateAutoHint: 'Ứng dụng tự điều khiển đêm và ngày.',
  entryCreateMod: 'Tạo & làm quản trò', entryCreateModHint: 'Bạn dẫn dắt ván chơi, không tham gia.',
  entryInPerson: 'Chơi cùng một phòng (tắt thoại, sói nhắn chữ ban đêm)',
  entryNameHint: 'Mọi người đều thấy tên. Không phải vai.',

  lobbyTitle: 'Trại', lobbyPlayers: '{n} người · cần {min}–{max}', lobbyInvite: 'Link mời', lobbyCopyLink: 'Chép link', lobbyCopyCode: 'Chép mã',
  lobbyStart: 'Bắt đầu', lobbyNeedMore: 'Cần thêm {n} người', lobbyNotAllReady: 'Chờ mọi người sẵn sàng', lobbyHostStarts: '{name} sẽ bắt đầu ván',
  lobbyEditLook: 'Sửa diện mạo', lobbySave: 'Lưu', lobbyModeAuto: 'Tự động', lobbyModeMod: 'Có quản trò', lobbyRolesTitle: 'Các vai trong ván', lobbyRolesLater: 'Vai được chia khi bắt đầu.',
  micTitle: 'Micro', micIdle: 'Kiểm tra mic trước khi chơi.', micCheck: 'Kiểm tra micro', micChecking: 'Đang nghe…', micOk: 'Mic hoạt động. Nói thử để thấy vạch nhảy.',
  micDenied: 'Micro bị chặn.', micDeniedHelp: 'Cho phép mic trong cài đặt trình duyệt, hoặc chơi bằng chat chữ.', micUnsupported: 'Trình duyệt này không thu được âm thanh.',
  micInsecure: 'Thoại cần kết nối bảo mật (https).', micRetry: 'Thử lại', micText: 'Chơi bằng chữ', micTextOn: 'Chỉ chat chữ. Bạn vẫn nghe được người khác.',
  micInPerson: 'Phòng chơi trực tiếp: tắt thoại, nói chuyện tại bàn. Sói nhắn chữ ban đêm.', micLater: 'Có thể đổi bất cứ lúc nào bằng nút mic.',

  roleWolf: 'Sói', roleVillager: 'Dân làng', roleSeer: 'Tiên tri', roleGuard: 'Bảo vệ', roleWitch: 'Phù thủy', roleHunter: 'Thợ săn',
  teamWolves: 'Phe Sói', teamVillage: 'Phe Dân',
  roleDescWolf: 'Mỗi đêm bầy sói chọn một nạn nhân. Ban ngày hãy hòa vào dân làng. Thắng khi số sói ít nhất bằng tất cả những người còn sống khác.',
  roleDescVillager: 'Không có phép, chỉ có tiếng nói và lá phiếu. Tìm ra sói.',
  roleDescSeer: 'Mỗi đêm soi một người để biết có phải sói không.',
  roleDescGuard: 'Mỗi đêm bảo vệ một người khỏi sói.',
  roleDescWitch: 'Một bình cứu, một bình độc cho cả ván.',
  roleDescHunter: 'Khi chết trong ván, bạn được bắn một người. Bị đưa khỏi ván thì không được bắn.',
  roleYouAre: 'Bạn là', roleTeam: 'Phe', rolePack: 'Bầy của bạn', roleKeepSecret: 'Giữ kín. Chạm để ẩn.', roleTapReveal: 'Chạm để xem', roleInPlay: 'Các vai trong ván này',
  roleFacts: 'Điều bạn biết', roleNoFacts: 'Chưa có gì.',

  phaseNight: 'Đêm {n}', phaseNightWitch: 'Đêm {n}', phaseHunter: 'Lượt Thợ săn', phaseDiscuss: 'Ngày {d} · Thảo luận', phaseVote: 'Ngày {d} · Đề cử',
  phaseDefense: 'Ngày {d} · Biện hộ', phaseConfirm: 'Ngày {d} · Phán quyết', phaseEnded: 'Kết thúc', phaseLobby: 'Phòng chờ',

  nightTitle: 'Đêm xuống', nightWait: 'Ở trong lều đến sáng.', nightDone: 'Xong. Chờ trời sáng.', nightChangeHint: 'Bạn có thể đổi lựa chọn đến khi hết đêm.',
  nightWolfTask: 'Cùng bầy chọn nạn nhân đêm nay', nightPackPicks: 'Bầy chọn', nightPackNone: 'Chưa chọn', nightPackPass: 'bỏ qua',
  nightSeerTask: 'Bạn muốn soi ai?', nightSeerResult: '{name} là', resultWolf: 'Sói', resultNotWolf: 'không phải Sói', nightSeerDone: 'Đã soi. Mỗi đêm một lần.',
  nightGuardTask: 'Đêm nay bảo vệ ai?', nightGuardLast: 'Đêm qua bạn bảo vệ {name}.',
  nightWaitHint: 'Đêm nay bạn không có việc gì. Đêm dài như nhau với mọi người.', votesShort: 'phiếu', votedCount: '{n}/{total} đã bỏ phiếu',
  nightChoose: 'Chọn', nightNoTarget: 'Không ai', nightSelected: 'Đã chọn: {name}',

  witchTask: 'Giờ của phù thủy', witchVictim: 'Sói đã cắn {name}.', witchNoVictim: 'Đêm nay không ai bị cắn.', witchVictimHidden: 'Bạn không còn biết ai bị cắn.',
  witchHealQ: 'Dùng bình cứu?', witchHeal: 'Cứu', witchNoHeal: 'Không cứu', witchHealed: 'Bạn sẽ cứu {name}.', witchNotHealed: 'Đêm nay không cứu.',
  witchPoisonQ: 'Đầu độc ai không?', witchPoisonWho: 'Chọn người để đầu độc, hoặc bỏ qua.', witchPoisoned: 'Độc: {name}', witchPotions: 'Bình thuốc', potionHeal: 'Cứu', potionPoison: 'Độc', potionUsed: 'đã dùng',

  hunterTitle: 'Thợ săn ngã xuống', hunterYou: 'Bạn là Thợ săn. Hãy bắn.', hunterShootWho: 'Bắn một người, hoặc bỏ qua.', hunterOthers: '{name} là Thợ săn và có thể bắn.',
  hunterWaiting: 'Chờ phát súng…', hunterShot: '{by} đã bắn {target}.', hunterNoShot: '{by} không bắn.', hunterSubmitted: 'Đã khóa phát súng.', hunterIso: 'Chat ma mở sau lượt của bạn.',

  dawnTitle: 'Bình minh', dawnNobody: 'Mọi người thức dậy. Không ai chết.', dawnDied: 'Không tỉnh dậy: {names}', dawnMourn: 'Cả trại lặng im.',

  discussTitle: 'Thảo luận', discussHint: 'Bàn bạc đi. Ai đáng ngờ?', discussCountdown: 'Hết giờ sẽ mở đề cử.',
  voteTitle: 'Ai bị đưa ra xét xử?', voteHint: 'Chọn một người, hoặc Không ai. Phiếu công khai: mọi người thấy ai bầu ai.', voteYours: 'Phiếu của bạn: {name}', voteYoursSkip: 'Phiếu của bạn: Không ai', voteNone: 'Chưa bỏ phiếu',
  voteCloses: 'Có thể đổi phiếu đến khi hết giờ.', voteNoTrial: 'Hôm nay không xét xử.', voteNoTrialTie: 'Hôm nay không xét xử (hòa hoặc Không ai thắng).', voteTrial: '{name} bị đưa ra xét xử.', voteTally: 'Kết quả đề cử',
  defenseTitle: '{name} biện hộ', defenseAccused: 'Lời biện hộ của bạn. Chỉ bạn được nói.', defenseOthers: 'Lắng nghe. Lúc này chỉ {name} được nói.', defenseNext: 'Sau đó mọi người bỏ phiếu Có hoặc Không.',
  confirmTitle: 'Treo cổ {name}?', confirmHint: 'Cần số phiếu Có nhiều hơn một nửa số người còn sống.', confirmYes: 'Có', confirmNo: 'Không', confirmYours: 'Phiếu của bạn: {choice}', confirmNone: 'Chưa bỏ phiếu',
  confirmExecuted: '{name} đã bị treo cổ.', confirmSpared: '{name} được tha.', confirmResult: 'Có {yes} · Không {no}', confirmDead: 'Bạn đã chết, không bỏ phiếu được.',
  livingCount: '{n} còn sống', votesCloseAt: 'Đóng sau',

  ghostTitle: 'Bạn là ma', ghostHint: 'Bay quanh trại. Nghe mọi chuyện công khai, trò chuyện với các ma khác. Người sống không thấy bạn.',
  ghostDiedNight: 'Bạn chết trong đêm.', ghostExecuted: 'Dân làng đã treo cổ bạn.', ghostShot: 'Thợ săn đã bắn bạn.', ghostRemoved: 'Bạn đã bị đưa khỏi ván.',

  endTitle: 'Kết thúc', endVillage: 'Dân làng thắng', endWolves: 'Sói thắng', endDraw: 'Không ai sống sót. Hòa.', endAborted: 'Ván bị hủy',
  endReasonNoWolves: 'Sói đã bị tiêu diệt hết.', endReasonParity: 'Số sói đã ít nhất bằng tất cả những người còn sống khác.', endReasonZero: 'Mọi người đều chết.', endReasonAborted: 'Quản trò đã kết thúc ván.',
  endReveal: 'Vai của mọi người', endHistory: 'Diễn biến các đêm', endSurvived: 'sống sót', endDied: 'đã chết',

  modConsole: 'Quản trò', modStep: 'Bước', modCloseStep: 'Kết thúc bước', modCloseConfirm: 'Kết thúc "{step}" ngay?', modSeats: 'Ghế', modNight: 'Đêm', modLog: 'Nhật ký', modDanger: 'Điều khiển',
  modRemove: 'Đưa khỏi ván', modRemoveConfirm: 'Đưa {name} khỏi ván? Không có phát súng Thợ săn, không hoàn tác.', modAbort: 'Hủy ván', modAbortConfirm: 'Kết thúc ván ngay, không có bên thắng?',
  modYesCount: 'Số phiếu Có đếm tại bàn', modYesHint: 'Nhập số phiếu Có từ giơ tay. Ứng dụng áp dụng Có×2 > còn sống.', modApply: 'Áp dụng',
  modSecretWarn: 'Mật · chỉ bạn xem',
  modNoTimer: 'Không có đồng hồ. Bạn giữ nhịp.', modVictim: 'Nạn nhân của bầy', modPicks: 'Sói chọn', modInspect: 'Tiên tri soi', modGuard: 'Bảo vệ che', modHeal: 'Cứu', modPoison: 'Độc',
  modSubmitted: 'Đã nhận hành động đêm: {n}/{total}', modSay: 'Nói',
  sayNightMain: 'Mọi người nhắm mắt. Sói mở mắt và chọn. Tiên tri soi. Bảo vệ che.',
  sayNightWitch: 'Sói nhắm mắt. Phù thủy mở mắt.', sayHunter: '{name} là Thợ săn. Thợ săn, hãy bắn.',
  sayDawnDead: 'Trời sáng. Đêm qua {names} đã chết.', sayDawnNobody: 'Trời sáng. Đêm qua không ai chết.', sayVote: 'Đề cử một người, hoặc Không ai. Hết giờ sẽ chốt phiếu.',
  sayDefense: '{name} biện hộ. Mọi người lắng nghe.', sayConfirm: 'Giơ tay nếu muốn treo cổ {name}. Đếm số phiếu Có và nhập vào.', sayEnded: 'Ván kết thúc. Lộ vai.',
  confirmYesOnly: 'Có {yes} (quản trò đếm)',
  modAlive: 'sống', modDead: 'chết', modDisconnected: 'mất kết nối', modInPerson: 'Phòng chơi trực tiếp',

  chatTitle: 'Chat', chatPh: 'Nhắn gì đó…', chatNone: 'Chưa có tin nhắn.', chatQuiet: 'Đang yên lặng. Chat mở khi bạn được nói.', chatListenOnly: 'Lúc này bạn chỉ đọc, không viết được.', chatPublic: 'Trại', chatWolves: 'Sói', chatGhosts: 'Ma',
  voiceMic: 'Mic', voiceMute: 'Tắt mic', voiceUnmute: 'Bật mic', voiceMuted: 'Đã tắt mic', voiceListen: 'Chỉ nghe', voiceOff: 'Tắt thoại', voiceTalking: 'Đang nói', voiceChannel: 'Kênh',

  helpTitle: 'Cách chơi', helpFlow: 'Mỗi đêm sói chọn nạn nhân và các vai đặc biệt hành động. Sáng ra công bố người chết. Ban ngày mọi người thảo luận, đề cử một người, nghe biện hộ rồi bỏ phiếu Có hoặc Không.',
  helpWin: 'Dân thắng khi hết sói. Sói thắng khi số sói ít nhất bằng tất cả những người còn sống khác, kể cả các vai đặc biệt.',
  helpRoles: 'Các vai trong ván này', helpRulesApproved: 'Luật', helpRuleVote: 'Đề cử: người nhiều phiếu nhất bị xét xử. "Không ai" cũng tính. Hòa hoặc "Không ai" thắng thì không xét xử.',
  helpRuleExec: 'Phán quyết: chỉ treo cổ khi Có × 2 > số người sống. Không bỏ phiếu tính như phản đối.', helpRuleNight: 'Đêm dài như nhau với mọi người và không kết thúc sớm.',
  helpRuleHunter: 'Thợ săn chết có 20 giây để bắn. Lượt này công khai.', helpRuleReveal: 'Chết bình thường không lộ vai. Thợ săn lộ vai khi lượt bắn mở. Cuối ván lộ hết.',
  helpRuleGhost: 'Ma giữ điều đã biết, không biết thêm bí mật, chỉ nói chuyện với ma.', helpRuleTimer: 'Đêm cố định 60 giây, biện hộ cố định 30 giây. Các khoảng thời gian khác theo cài đặt ván.',
  helpWitch: 'Phù thủy: một bình cứu, một bình độc, dùng chung một đêm được. Tự cứu được, tự đầu độc không. Chỉ biết nạn nhân khi chưa dùng bình cứu.',
  helpProvisional: 'Tạm thời (chưa quyết; theo cài đặt hiện tại của ván):', helpProvSeer: 'Tiên tri biết: là sói hay không phải sói.', helpProvGuard: 'Bảo vệ: được tự bảo vệ, không che cùng một người hai đêm liền; không chặn độc.', helpProvWolfPass: 'Sói có thể chọn không ai.', helpProvPlayers: '{min}–{max} người chơi.',

  annNight: 'Đêm xuống', annDawn: 'Bình minh', annVote: 'Mở đề cử', annDefense: 'Biện hộ', annConfirm: 'Phán quyết', annYourTurn: 'Đến lượt bạn', annOver: 'Kết thúc',
  annDied: '{name} đã chết', annExecuted: '{name} bị treo cổ', annShot: '{by} bắn {target}', annHunter: '{name} là Thợ săn',

  provisional: 'tạm thời', ambience: 'Âm thanh trại', sceneSetting: 'Cảnh trại', wakeHint: 'Giữ màn hình sáng trong ván.', copyManual: 'Không chép tự động được. Nhấn giữ link để chép.', youLabel: 'Bạn', modNarrationSetting: 'Gợi ý lời dẫn (tạm thời)', 
  a11yTimer: 'còn {s} giây', a11ySeat: '{name}, {state}', a11yDead: 'đã chết', a11yAlive: 'còn sống', a11ySpeaking: 'đang nói', a11yYou: 'bạn', a11yTarget: 'chọn {name}',
  stepDisplay: { 'night.main': 'Đêm', 'night.witch': 'Phù thủy', hunter: 'Thợ săn', 'day.discussion': 'Thảo luận', 'day.vote': 'Đề cử', 'day.defense': 'Biện hộ', 'day.confirm': 'Phán quyết', ended: 'Kết thúc' },
};
