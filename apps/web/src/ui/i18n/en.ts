// English strings. Keys are stable; vi.ts must have the same keys. {name}-style params.
export const en = {
  app: 'Moonveil',
  ok: 'OK', cancel: 'Cancel', confirm: 'Confirm', pass: 'Pass', skip: 'Skip', done: 'Done', back: 'Back', close: 'Close',
  send: 'Send', copy: 'Copy', copied: 'Copied', you: 'you', host: 'host', moderator: 'Moderator', online: 'online', offline: 'offline',
  ready: 'Ready', notReady: 'Not ready', leave: 'Leave room', help: 'Help', settings: 'Settings', chat: 'Chat', roleCard: 'My role',
  language: 'Language', sound: 'Sound cues', on: 'On', off: 'Off', motion: 'Motion', motionSystem: 'Follow device', motionReduce: 'Reduce', motionFull: 'Full',
  change: 'Change', waiting: 'Waiting…', seconds: '{s} s',

  connConnected: 'Connected', connReconnecting: 'Reconnecting…', connReconnectHint: 'Your seat is kept. The game continues.',
  connReplaced: 'Opened in another tab.', connUseHere: 'Use here', connEnded: 'You left the room.', connOffline: 'Offline',

  entryTagline: 'Werewolf by the campfire. One phone each, voices in the game.',
  entryName: 'Your name', entryNamePh: 'e.g. Linh', entryLook: 'Your look', entryColour: 'Colour', entryHat: 'Hat',
  entryCode: 'Room code', entryJoin: 'Join room', entryOr: 'or start a new room', entryCreateAuto: 'Create & play', entryCreateAutoHint: 'The app runs the night and day.',
  entryCreateMod: 'Create & moderate', entryCreateModHint: "You narrate and run the match. You don't play.",
  entryInPerson: 'We are in one room (voice off, wolves text at night)',
  entryNameHint: 'Shown to everyone. Not your role.',

  lobbyTitle: 'Camp', lobbyPlayers: '{n} players · {min}–{max} to play', lobbyInvite: 'Invite link', lobbyCopyLink: 'Copy link', lobbyCopyCode: 'Copy code',
  lobbyStart: 'Start match', lobbyNeedMore: 'Need {n} more', lobbyNotAllReady: 'Waiting for everyone to be ready', lobbyHostStarts: '{name} starts the match',
  lobbyEditLook: 'Edit look', lobbySave: 'Save', lobbyModeAuto: 'Automatic', lobbyModeMod: 'Moderated', lobbyRolesTitle: 'Roles in play', lobbyRolesLater: 'Roles are dealt at start.',
  micTitle: 'Microphone', micIdle: 'Check your mic before the match.', micCheck: 'Check microphone', micChecking: 'Listening…', micOk: 'Mic works. Say something to see the meter move.',
  micDenied: 'Microphone blocked.', micDeniedHelp: 'Allow the mic in your browser settings, or play by text chat.', micUnsupported: 'This browser cannot capture audio.',
  micInsecure: 'Voice needs a secure (https) connection.', micRetry: 'Try again', micText: 'Play by text', micTextOn: 'Text only. You still hear others.',
  micInPerson: 'In-person room: voice is off, talk at the table. Wolves use text at night.', micLater: 'You can change this any time from the mic button.',

  roleWolf: 'Wolf', roleVillager: 'Villager', roleSeer: 'Seer', roleGuard: 'Guard', roleWitch: 'Witch', roleHunter: 'Hunter',
  teamWolves: 'Wolves', teamVillage: 'Village',
  roleDescWolf: 'Each night the pack chooses one victim. By day, blend in. Win when the wolves are at least as many as everyone else alive.',
  roleDescVillager: 'No power but your voice and your vote. Find the wolves.',
  roleDescSeer: 'Each night, learn whether one player is a wolf.',
  roleDescGuard: 'Each night, protect one player from the wolves.',
  roleDescWitch: 'One healing potion, one poison, for the whole match.',
  roleDescHunter: 'When you die in play, you may shoot one player. Being removed from the match gives no shot.',
  roleYouAre: 'You are', roleTeam: 'Team', rolePack: 'Your pack', roleKeepSecret: 'Keep this to yourself. Tap to hide.', roleTapReveal: 'Tap to reveal', roleInPlay: 'Roles in this match',
  roleFacts: 'What you know', roleNoFacts: 'Nothing yet.',

  phaseNight: 'Night {n}', phaseNightWitch: 'Night {n}', phaseHunter: "Hunter's turn", phaseDiscuss: 'Day {d} · Discussion', phaseVote: 'Day {d} · Nomination',
  phaseDefense: 'Day {d} · Defense', phaseConfirm: 'Day {d} · Verdict', phaseEnded: 'Match over', phaseLobby: 'Lobby',

  nightTitle: 'Night falls', nightWait: 'Stay in your tent until dawn.', nightDone: 'Done. Wait for dawn.', nightChangeHint: 'You can change your choice until the night ends.',
  nightWolfTask: 'Choose tonight\'s victim with your pack', nightPackPicks: 'Pack picks', nightPackNone: 'No pick yet', nightPackPass: 'passes',
  nightSeerTask: 'Who do you want to see?', nightSeerResult: '{name} is', resultWolf: 'a Wolf', resultNotWolf: 'not a Wolf', nightSeerDone: 'Seen. One look per night.',
  nightGuardTask: 'Who do you protect tonight?', nightGuardLast: 'Last night you protected {name}.',
  nightWaitHint: 'Nothing to do tonight. The night lasts the same for everyone.', votesShort: 'votes', votedCount: '{n} of {total} voted',
  nightChoose: 'Choose', nightNoTarget: 'Nobody', nightSelected: 'Selected: {name}',

  witchTask: 'The witch\'s hour', witchVictim: 'The wolves attacked {name}.', witchNoVictim: 'Nobody was attacked tonight.', witchVictimHidden: 'You no longer learn who was attacked.',
  witchHealQ: 'Use your healing potion?', witchHeal: 'Heal', witchNoHeal: 'Let it be', witchHealed: 'You will heal {name}.', witchNotHealed: 'No heal tonight.',
  witchPoisonQ: 'Poison someone?', witchPoisonWho: 'Choose who to poison, or pass.', witchPoisoned: 'Poison: {name}', witchPotions: 'Potions', potionHeal: 'Heal', potionPoison: 'Poison', potionUsed: 'used',

  hunterTitle: 'The Hunter falls', hunterYou: 'You are the Hunter. Take your shot.', hunterShootWho: 'Shoot one player, or let it pass.', hunterOthers: '{name} is the Hunter and may shoot.',
  hunterWaiting: 'Waiting for the shot…', hunterShot: '{by} shot {target}.', hunterNoShot: '{by} did not shoot.', hunterSubmitted: 'Shot locked.', hunterIso: 'Ghost chat opens after your turn.',

  dawnTitle: 'Dawn', dawnNobody: 'Everyone wakes up. Nobody died.', dawnDied: 'Did not wake up: {names}', dawnMourn: 'The camp falls silent.',

  discussTitle: 'Discussion', discussHint: 'Talk it out. Who seems off?', discussCountdown: 'Nomination opens when time is up.',
  voteTitle: 'Who goes on trial?', voteHint: 'Pick one player, or Skip. Votes are open: everyone sees who voted for whom.', voteYours: 'Your vote: {name}', voteYoursSkip: 'Your vote: Skip', voteNone: 'No vote yet',
  voteCloses: 'You can change your vote until time is up.', voteNoTrial: 'No trial today.', voteNoTrialTie: 'No trial today (tie or Skip).', voteTrial: '{name} goes on trial.', voteTally: 'Nomination results',
  defenseTitle: '{name} speaks', defenseAccused: 'Your defense. Only you may speak.', defenseOthers: 'Listen. Only {name} may speak now.', defenseNext: 'Then everyone votes Yes or No.',
  confirmTitle: 'Execute {name}?', confirmHint: 'Yes needs more than half of all living players.', confirmYes: 'Yes', confirmNo: 'No', confirmYours: 'Your ballot: {choice}', confirmNone: 'No ballot yet',
  confirmExecuted: '{name} was executed.', confirmSpared: '{name} is spared.', confirmResult: 'Yes {yes} · No {no}', confirmDead: 'You are dead and cannot vote.',
  livingCount: '{n} living', votesCloseAt: 'Closes in',

  ghostTitle: 'You are a ghost', ghostHint: 'Drift around camp. Hear everything public, talk with other ghosts. The living cannot see you.',
  ghostDiedNight: 'You died in the night.', ghostExecuted: 'The village executed you.', ghostShot: 'The Hunter shot you.', ghostRemoved: 'You were removed from the match.',

  endTitle: 'Match over', endVillage: 'The village wins', endWolves: 'The wolves win', endDraw: 'Nobody survives. A draw.', endAborted: 'Match aborted',
  endReasonNoWolves: 'All wolves are gone.', endReasonParity: 'The wolves are at least as many as everyone else alive.', endReasonZero: 'Everyone is dead.', endReasonAborted: 'The moderator ended the match.',
  endReveal: 'Everyone\'s roles', endHistory: 'Night history', endSurvived: 'survived', endDied: 'died',

  modConsole: 'Moderator', modStep: 'Step', modCloseStep: 'Close step', modCloseConfirm: 'Close "{step}" now?', modSeats: 'Seats', modNight: 'Night', modLog: 'Log', modDanger: 'Controls',
  modRemove: 'Remove player', modRemoveConfirm: 'Remove {name} from the match? No Hunter shot, no undo.', modAbort: 'Abort match', modAbortConfirm: 'End the match now with no winner?',
  modYesCount: 'Yes votes counted at the table', modYesHint: 'Enter the Yes count from the show of hands. The app applies Yes×2 > living.', modApply: 'Apply',
  modSecretWarn: 'Secret · your eyes only',
  modNoTimer: 'No timer. You set the pace.', modVictim: 'Pack victim', modPicks: 'Wolf picks', modInspect: 'Seer looks at', modGuard: 'Guard protects', modHeal: 'Heal', modPoison: 'Poison',
  modSubmitted: 'Night inputs in: {n} of {total}', modSay: 'Say',
  sayNightMain: 'Everyone, eyes closed. Wolves, open your eyes and choose. Seer, look. Guard, protect.',
  sayNightWitch: 'Wolves, eyes closed. Witch, open your eyes.', sayHunter: '{name} is the Hunter. Hunter, take your shot.',
  sayDawnDead: 'Morning. Last night we lost {names}.', sayDawnNobody: 'Morning. Nobody died last night.', sayVote: 'Nominate someone, or Skip. Votes close at the deadline.',
  sayDefense: '{name}, your defense. Everyone else listens.', sayConfirm: 'Hands up to execute {name}. Count the Yes votes and enter the number.', sayEnded: 'The match is over. Roles are revealed.',
  confirmYesOnly: 'Yes {yes} (counted by the moderator)',
  modAlive: 'alive', modDead: 'dead', modDisconnected: 'disconnected', modInPerson: 'In-person room',

  chatTitle: 'Chat', chatPh: 'Message…', chatNone: 'No messages yet.', chatQuiet: 'Quiet for now. Chat opens when you may talk.', chatListenOnly: 'You can read, not write, here now.', chatPublic: 'Camp', chatWolves: 'Wolves', chatGhosts: 'Ghosts',
  voiceMic: 'Mic', voiceMute: 'Mute', voiceUnmute: 'Unmute', voiceMuted: 'Muted', voiceListen: 'Listen only', voiceOff: 'Voice off', voiceTalking: 'Talking', voiceChannel: 'Channel',

  helpTitle: 'How to play', helpFlow: 'Each night the wolves pick a victim and special roles act. At dawn the dead are announced. By day everyone talks, nominates one player, hears their defense and votes Yes or No.',
  helpWin: 'The village wins when no wolves remain. The wolves win when they are at least as many as everyone else alive, special roles included.',
  helpRoles: 'Roles in this match', helpRulesApproved: 'Rules', helpRuleVote: 'Nomination: the single top vote-getter goes on trial. Skip counts. A tie or a Skip win means no trial.',
  helpRuleExec: 'Verdict: executed only if Yes × 2 > living players. Not voting counts against execution.', helpRuleNight: 'Nights last the same time for everyone and never end early.',
  helpRuleHunter: 'A Hunter who dies gets 20 s to shoot. The turn is public.', helpRuleReveal: 'No role is revealed on an ordinary death. The Hunter is revealed when their shot turn opens. All roles are revealed at the end.',
  helpRuleGhost: 'Ghosts keep what they knew, learn no secrets, and talk only with ghosts.', helpRuleTimer: 'Nights are a fixed 60 s and the defense a fixed 30 s. Other durations come from the match settings.',
  helpWitch: 'Witch: one heal, one poison, both usable in one night. Self-heal yes, self-poison no. She sees the victim only while her heal is unused.',
  helpProvisional: 'Provisional (not yet decided; follows the current match settings):', helpProvSeer: 'What the Seer learns: wolf or not a wolf.', helpProvGuard: 'Guard: may protect themselves, not the same player two nights in a row; does not block poison.', helpProvWolfPass: 'Wolves may choose nobody.', helpRulePlayers: '{min}–{max} players. Roles per match: see "Roles in this match" (the host\'s deck is validated by the engine).',

  annNight: 'Night falls', annDawn: 'Dawn', annVote: 'Nomination open', annDefense: 'Defense', annConfirm: 'Verdict', annYourTurn: 'Your turn', annOver: 'Match over',
  annDied: '{name} died', annExecuted: '{name} executed', annShot: '{by} shot {target}', annHunter: '{name} is the Hunter',

  provisional: 'provisional', ambience: 'Camp ambience', sceneSetting: 'Camp scene', wakeHint: 'Keep your screen on during the match.', copyManual: 'Copy not available here. Long-press the link to copy it.', youLabel: 'You', modNarrationSetting: 'Narration cues (provisional)', 
  a11yTimer: '{s} seconds left', a11ySeat: '{name}, {state}', a11yDead: 'dead', a11yAlive: 'alive', a11ySpeaking: 'speaking', a11yYou: 'you', a11yTarget: 'choose {name}',
  stepDisplay: { 'night.main': 'Night', 'night.witch': 'Witch', hunter: 'Hunter', 'day.discussion': 'Discussion', 'day.vote': 'Nomination', 'day.defense': 'Defense', 'day.confirm': 'Verdict', ended: 'Ended' } as Record<string, string>,
};
export type Strings = typeof en;
