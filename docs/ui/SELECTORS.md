# Stable selectors and test hooks (game UI)

For foundation's browser harness (`e2e/harness`). Contract: `data-testid` + `data-*` state attributes, stable across
visual changes. Text is localized (vi/en) and must not be asserted on. Everything below exists on the game-ui branch;
`apps/web/src/ui/dev/real-check.mjs` drives a full real-server match with exactly these hooks.

## Shell and connection
| Hook | Where | Meaning |
|---|---|---|
| `[data-testid=app][data-phase=day\|night\|ghost\|ended]` | root | current skin |
| `[data-testid=entry]` | entry | create/join screen |
| `[data-testid=name]`, `[data-testid=code]`, `[data-testid=hat]`, `[data-testid=color-<id>]`, `[data-testid=in-person]` | entry/lobby | profile + room code + in-person checkbox |
| `[data-testid=join]`, `[data-testid=create-automatic]`, `[data-testid=create-moderator]` | entry | actions |
| `[data-testid=room][data-status=lobby\|playing\|ended][data-kind=player\|moderator][data-step=<step.kind>][data-wake=on\|off\|failed\|unsupported]` | frame | room state (present in lobby and match) |
| `[data-testid=conn][data-status=open\|connecting\|reconnecting\|replaced\|ended]` | one element | connection; `open` = chip, others = overlay |
| `[data-testid=left-note]` | entry | after a voluntary Leave: "You left room X" (`ended` is never shown for it) |
| `[data-testid=go-home]` | `conn[data-status=ended]` overlay | involuntary end: back to the entry screen at "/" |
| `[data-testid=you]` | lobby header / match top bar | this seat's display name (moderator shows the moderator name) |
| `[data-testid=error][data-code=<server error code>]` | entry/lobby/match | last server error; assert on `data-code`, the text is localized copy |
| `[data-testid=scene-slot]` | scene host | canvas mount (absent when Settings → scene is off) |
| `localStorage['moonveil.ui.settings']` | init script | `{ lang, sound, reducedMotion, modNarration, ambience, scene }`; set `scene:false, sound:false, reducedMotion:'on'` for many-context runs |

## Lobby
`[data-testid=room-code]`, `[data-testid=copy-link]`, `[data-testid=copy-manual]` (insecure-origin fallback), `[data-testid=seats]` with
`[data-testid=seat][data-seat=<id>][data-ready][data-connected]`, `[data-testid=ready]` (`aria-pressed`), `[data-testid=start]`,
`[data-testid=edit-profile]` (toggles to Cancel while editing), `[data-testid=edit-look]`, `[data-testid=cancel-profile]`, `[data-testid=save-profile]`, `[data-testid=you-look][data-color][data-hat]` (+ `you-preview` while a draft differs), `[data-testid=leave]`, `[data-testid=mic][data-status=idle|checking|ok|denied|unsupported|insecure|inPerson]`,
`[data-testid=mic-check]`, `[data-testid=mic-retry]`, `[data-testid=mic-text]`.

## Lobby deck (host customization, P12)
`[data-testid=deck][data-custom=true|false][data-error=true|false]`, `[data-testid=deck-counts] [data-role=<role>][data-count=<n>]`, `[data-testid=deck-error]`,
host only: `[data-testid=deck-edit]` → `[data-role=<role>] button[aria-label^="+"|"-"]` → `[data-testid=deck-apply]`; `[data-testid=deck-reset]` when custom. Server errors also land in `[data-testid=error]`.

## Voice (single VoiceClient from client.ts, `__moonveil.voice`)
`[data-testid=voice][data-speak=<channels>][data-mic=…][data-muted][data-voice=off|notJoined|connecting|reconnecting|live|listening|denied|failed]` in the match top bar (`voice-label` text); lobby `[data-testid=mic][data-voice=…]` with `voice-busy` while connecting/reconnecting; `[data-testid=audio-unlock]` when autoplay is blocked; `voice-retry` (unavailable/failed), `voice-off` (server-side voice off, P19). Dev knob `__MOONVEIL_VOICE_TIMEOUT_MS` shortens the 30 s bound.
Lobby `[data-testid=mic][data-status=…]`: with a VoiceClient, `ok|checking|idle|denied|failed` from its snapshot plus `[data-testid=mic-mute]` / `[data-testid=mic-reload]`; without one (in-person, stub), the local check hooks listed above.

## Match
| Hook | Meaning |
|---|---|
| `[data-testid=match][data-step=<step.kind>]` | match frame |
| `[data-testid=phase-title]`, `[data-testid=timer]` (`role=timer`, text = seconds left) | top bar |
| `[data-testid=open-chat]`, `[data-testid=open-role]`, `[data-testid=open-help]` | sheet openers (same set for every seat) |
| `[data-testid=voice][data-speak=<channels with speak grant>]` | mic bar; empty = listen only |
| panel ids: `night-wolf`, `night-seer`, `night-guard`, `night-witch`, `night-wait`, `hunter-shoot`, `hunter-wait`, `day-discussion`, `day-vote`, `day-defense`, `day-confirm`, `ended` | the dock panel for this seat's view |
| `[data-testid=seat-<index>]` (`.seat-chip`, `aria-pressed` when selectable, `disabled` when not a legal target) | seat grid cells (engine seat index) |
| `[data-testid=confirm]` | submit the selected seat (disabled until a legal selection differs from the current one) |
| `[data-testid=heal-yes]`, `[data-testid=heal-no]` | witch |
| `[data-testid=seer-result]` | seer's inline result (from `me.facts`) |
| `[data-testid=vote-skip]`, `[data-testid=my-vote]`, `[data-testid=ballots] li`, `[data-testid=voted-count]` | nomination: live voter→choice list |
| `[data-testid=vote-yes]`, `[data-testid=vote-no]`, `[data-testid=my-ballot]`, `[data-testid=confirm-tally]` | verdict |
| `[data-testid=ghost-bar]` | dead seat |
| `[data-testid=ghost-panel][data-step=<step.kind>]` | dead seat's read-only panel (both modes): seats, live ballots; never `confirm`/`vote-*`. A pending Hunter gets `hunter-shoot` instead |
| `[data-testid=announce]` | dawn/execution/shot overlay (transient, ~3 s) |
| `[data-testid=ended] .seat-chip .tag` | revealed roles (one per seat) |
| `[data-testid=wake-hint]` | wake lock unavailable |

## Look editor (test hooks)
Picker: `[data-testid=look-picker][data-outfit][data-variant]` → `outfit-<id>` (radio chips, catalog order), `variant-<id>` (when several), `color-<id>` (swatches, `aria-checked`), selects `hat` / `front` / `back` (option values = catalog ids; shown when several). `[data-testid=you-look][data-outfit][data-variant][data-color][data-hat]`. Same picker on the entry screen.
`globalThis.__moonveilLook` = draft store (`get()` → `{ draft, pendingSince, notice, ctx }`); `globalThis.__moonveilScene` = the mounted scene handle (`localPose()`, visual's `debugAppearance(seatId)`); `__MOONVEIL_LOOK_BOUND_MS` shortens the 6 s save bound. `[data-testid=look-not-saved]` notice.

## Chat overlay
`[data-testid=chat-overlay][data-channels=<listen channels>][data-compact=true|false]` (always rendered, same box for every seat), `chat-recent` (role=log), `chat-item[data-channel][data-from=<sender seat id>]` with `.avatar` / `.co-from` / `.co-text` / `.co-ch`, `chat-overlay-input` (laptop box only, only with a speak grant; a disabled placeholder row otherwise), `chat-overlay-channel` (when several speakable), `chat-overlay-send`, `chat-history` (opens the sheet; on compact phones the 💬 button, write there via `chat-input`), `chat-quiet` when no channel is listenable. Sheet messages: `[data-testid=chat-log] .chat-msg[data-from]`. Scene: `[data-testid=scene-slot][data-safe-bottom]` = bottom inset passed to the scene.

## Sheets
`[data-testid=role-sheet]` → `[data-testid=role-card][data-shown]` (tap to reveal) → `[data-testid=my-role]`, `[data-testid=facts]`, `[data-testid=roles-in-play]`.
`[data-testid=chat-sheet]` → `[data-testid=chat-tab][data-channel=<channel>]` (only channels with a listen grant), `[data-testid=chat-log][data-channel]`, `[data-testid=chat-input]`, `[data-testid=chat-send]`, `[data-testid=chat-listen-only]`, `[data-testid=chat-quiet]` (no grants at all).
`[data-testid=help-sheet]` → `[data-testid=help-provisional]`.

## Moderator
`[data-testid=mod-console]`, `[data-testid=mod-step]` (step label), `[data-testid=close-step]` → `[role=alertdialog] .btn` (2nd = confirm),
`[data-testid=yes-count]` + `[data-testid=yes-apply]` (day.confirm), `[data-testid=mod-seat-<index>]`, `[data-testid=mod-night]`, `[data-testid=public-log]`.
Approved end-match (separate moderator only): `[data-testid=end-match][data-open]` → `end-match-open` → `end-match-input` (type END) → `end-match-confirm` (disabled until the word matches) / `end-match-cancel`.
`[data-testid=stalemate-warning]` (dock banner while the engine's warning is active). End screen: `[data-testid=ended][data-winner][data-reason]`, `[data-testid=end-title]`.
Provisional, hidden unless config enables: remove buttons, `[data-testid=mod-say]`.

## Driving a seat through a night (what real-check.mjs does)
1. `confirm` present? else nothing to do (waiting panel).
2. click first `.seat-grid button[aria-pressed]:not([disabled])`; if `confirm` is enabled, click it.
3. Witch: `heal-yes`/`heal-no` first, then step 2 for poison or leave it.
Day: `seat-<i>` + `confirm` (nominate), `vote-skip`; `vote-yes`/`vote-no`. Moderator: `close-step` + dialog confirm.

## Proposed additions if the harness wants more
- `window.__moonveil` (foundation's client) already exposes the seat's own state; no secret beyond it is exposed by the UI.
- A `data-testid=step-seq` attribute could carry `stepSeq` if the harness needs to await "step changed" without comparing kinds; not added yet.
