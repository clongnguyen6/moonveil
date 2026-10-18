# Game UI: screen map and flow

Owner: game-ui (`apps/web/src/game/**`, `apps/web/src/ui/**`). Status: built against the in-browser stub
(`src/game/stub`, runs the real `@moonveil/rules` engine); server wiring pending (docs/ui/PROPOSALS.md).
Run: `WEB_PORT=4401 node scripts/env.mjs npm run dev -w @moonveil/web` → `http://127.0.0.1:4401/src/ui/dev/index.html?scenario=<name>&lang=vi|en`.
Captures: `docs/ui/screens/` (browser emulation only; `apps/web/src/ui/dev/capture.mjs`).

## Principles (binding)
- Render only `SeatView` + the seat's `Projection`. No inference, caching or client filtering of secrets. Facts shown = `me.facts`; menus = `me.actions`.
- Approved rules are copy only (help text). Everything else (timers, targets, potions, who may vote) comes from the projection/actions, so a rules change needs no UI change.
- Night: one panel layout for every role (head · task · info slot · seat grid · two buttons · status line). Roles without an action get a private note task of the same shape. The panel never ends a step; the timer is the server deadline.
- Votes (APPROVED 2026-10-16, supersedes "own ballot only"): open ballots, live, rendered from `step.votes` (per voter: target / Skip / Yes / No) and `step.voted`; counts derive from them. Until the rules projection ships `votes` to players, the UI shows who voted (`voted`) and the own ballot. Deadlines fixed; nothing closes early. Night stays private; wolf picks wolf-only.
- Channels (voice + text + indicators) come only from `view.voice` grants. No grant → no trace of the channel.
- Every screen is a pure function of the latest snapshot → reconnect = re-render. Reconnecting shows an overlay over the last view; history is never replayed as new announcements.
- Theme = `ui/theme/tokens.css` + `ui/theme/skin.css` only. Phase skins via `html[data-phase=day|night|ghost|ended]`. Structure in `ui/layout.css`.

## Screen map
```
Entry ──create/join──▶ Lobby ──start──▶ Match ──ended──▶ End reveal ──leave──▶ Entry
                        │ mic check (ok / denied / unsupported / insecure / in-person)
                        │ invite link, ready, edit look, settings, help, chat(public)
Match (frame = scene host + top bar + dock)
  top bar: phase title, room code, voice bar (grant-driven), chat, role card, help, settings
  dock (by step and seat):
    night.main   wolf → WolfPanel (pack picks live)   seer → SeerPanel (result inline)   guard → GuardPanel
                 others / dead → waiting panel (same frame, grid shown, buttons blank)
    night.witch  witch → WitchPanel (victim line, heal yes/no, poison grid)   others → waiting panel
    hunter       pending hunter → HunterPanel (shoot/pass)   others → wait panel (hunter named)
    day.discussion → DiscussionPanel (seats, speaking rings)
    day.vote       → VotePanel (grid with live vote counts per target, ballot list per voter, Skip/Confirm, own vote line)
    day.defense    → DefensePanel (accused; speak rights by grant)
    day.confirm    → ConfirmPanel (live Yes/No tally + per-voter tags, Yes/No, own ballot line, living count)
    ended          → EndPanel (winner, reason, all roles, history if provided, leave)
  ghost bar (dead seat): cause, ghost hint or Hunter-pending isolation note; skin → ghost
  dead seat (both modes, every step except a pending Hunter shot): GhostPanel = read-only seats + live ballots + timer; no action hooks
  moderator (kind=moderator): ModeratorConsole replaces the dock: Step (close step, Yes-count entry on day.confirm) · Seats (roles) · Night record · Log
    approved: close step, Yes count, listening to all channels. PROVISIONAL (hidden unless the engine config enables them; no flag exists today):
    remove player (`moderator.canRemove`), abort (`moderator.canAbort`). Narration cue line: behind Settings → "Narration cues", default off.
  sheets: Role card (tap to reveal; team, pack, facts, potions, roles in play) · Help · Chat (tabs = listen grants; input only with speak grant) · Settings (language, sound, motion)
  overlays: Night falls · Dawn (+dead) · Executed · Shot; toasts: nomination result, verdict counts, Hunter turn, vote open
  connection overlay: reconnecting / replaced (use here) / ended
```

## Interaction flow per step (player)
| Step | Player sees | Acts | Feedback |
|---|---|---|---|
| night.main | Night N, timer, role task | tap seat → Confirm (or Pass) | status line "done / change until close"; wolves see pack picks as tags + pills |
| night.witch | same frame | Heal / Let it be; seat → Poison or Pass | potion pills; status |
| hunter | Hunter's turn (public) | pending hunter: seat → Confirm / Pass | "shot locked"; others see waiting panel |
| dawn (enter day) | overlay: dead names or nobody | — | cue: dawn/death |
| day.discussion | seats, speaking, notes, timer | talk (voice by grant) | — |
| day.vote | grid, Skip, Confirm, live ballots | own vote changeable until close | live per-voter list + counts; toast at close: trial / no trial |
| day.defense | accused card | accused speaks (grant) | — |
| day.confirm | Yes / No, live tally | own ballot changeable until close | live Yes/No per voter; overlay: executed |
| ended | winner, reveal | leave | cue: victory/defeat |

## Leaving
Leave (lobby, end screen) is voluntary: the session adapter remembers it; when the session ends the player is on the entry screen at "/" (replaceState, so Back has no /r/<code> entry) with a short "You left room X" note. client.ts already drops the resume token, intent and voice on bye. Refresh/Back never rejoin; the old invite URL only offers Join. Involuntary ends (room closed, e.g. by the moderator leaving; seat removed; tab not reclaimed) keep the overlay, now "You are no longer in this room" + Back to start. Reconnects (drop, reload with token) are untouched. Proof: `ui/dev/leave-check.mjs` (real server), stub 11n.

## Errors
A server error shows only on the screen it arrived on (entry, lobby, or one match step instance; `ui/errors.ts` `screenError`): the client keeps the last error until the next connect, so without this a lobby refusal stayed in the match dock. The look editor counts only an error that arrives after Save as that save's refusal. Proof: stub 11m, picker-check (Chi's lobby refusal absent from the match dock).

## Accessibility (keyboard + screen reader)
- Names: every icon-only control carries `aria-label`; avatars are decorative; the seat grid is a labelled group ("use arrow keys, Enter to choose"); the match frame is a `main` named after the phase; the top bar is a toolbar; the phase title is the page `h1`.
- Keyboard: Tab order follows the DOM (title → tools → panel → grid → buttons); arrow keys / Home / End move within the seat grid; Enter/Space choose; chat sends on Enter; end-match confirms on Enter once the word matches; sheets trap Tab, open on their first body control, close on Escape and return focus to the opener.
- Focus rings: `--focus` ring on buttons, inputs, selects, seat chips, tabs, swatches, the role card.
- Live region: one polite `role=status` (`data-testid=live`) announces phase titles and the same public announcements as the toasts/overlays; it never carries role, facts or pack data.

## Accessibility and layout
- Touch targets ≥ 44 px (`--tap`), focus rings, `aria-pressed` on choices, `role=timer`, `aria-live` status lines, dialog semantics on sheets, Escape closes.
- Reduced motion: system preference or setting zeroes all durations.
- Phone portrait: scene top, dock bottom (≤ 62 % height, scrolls). Phone landscape / laptop (≥ 700 px, landscape): scene left, dock right (420–440 px).
- Contrast: ink on surfaces ≥ 7:1 in both skins (tokens chosen for it; verify after theme decision).

## Uniformity guards (night) and residual tells
- Same panel structure for every role (checked: `panel-head>hint>info-slot>seat-grid>btn-row>muted` on villager, seer, guard, wolf).
- No-action panel: the two-button slot holds labelled, neutral, disabled buttons ("No action tonight" / "Waiting for dawn"), identical for every no-action role; same row box as the action panels (stub check).
- Top bar: same button count for every seat at night; mic button neutral and label-less at night; chat button always present (a seat with no listen grant gets an empty "quiet" sheet, no channel named).
- Seat grid tags roles only when publicly revealed (Hunter turn) or at match end; own role and pack live in the role card (tap to reveal).
- Residual: a wolf's mic tap toggles the glyph; the Witch panel has heal buttons in the info slot (same slot height). In in-person rooms voice is off, which removes the mic tell where glancing is possible.
- Not covered here: wire traffic (PROPOSALS.md P10) and voice-provider metadata (voice scope).

## Layout and accessibility checks
`node scripts/env.mjs node apps/web/src/ui/dev/layout-check.mjs --webkit` (vite on 4401): every scenario and sheet at phone portrait 390×844, phone landscape 844×390 and laptop 1440×900 in Chromium headless shell, plus iPhone 13 portrait/landscape in WebKit (all emulation; landscape also at 667×375 and 932×430). Asserts no horizontal overflow (document, dock, lobby, sheets), visible text ≥ 13 px, interactive targets ≥ 44 px (icons/swatches ≥ 40; label-wrapped checkboxes measured by their label), text contrast ≥ 4.5:1 against its composited surface (3:1 for large text; text over the scene/top bar excluded, it has shadows), bottom padding floor for safe areas, and the primary button fully inside the viewport after scrolling the dock. 336/336.
Top bar (added): every control fully inside the scene host, unobstructed at its centre and ≥ 44 px at phone landscape 844×390, 667×375, 932×430 and WebKit iPhone 13 landscape; phone landscape bar spans the scene host, 44 px icons, tools wrap. Captures `docs/ui/screens-followups/`. Fixes it drove: `--fs-0` 0.85rem, 24 px checkboxes with 44 px label rows, 44 px selects, lighter muted/team/ghost tokens (ink-3, wolves, village, ghost) for contrast.

## Polish (theme layer only)
Dock panel re-enters on every step instance (keyed by step/night/day); announcements fade in and out; timer pulses under 10 s; picked chip pops; confirm turns into a green "Chosen" state with a ✓ status line; haptic tick on confirms (`navigator.vibrate` where available); all motion off under reduced motion. Microcopy: "Chosen. You can still change it until dawn.", "You have not voted yet", consistent night copy in vi/en.

## Scene and the heavy-run rule
Any browser automation that renders the scene is heavy (software WebGL ≈ 8 cores per page) and needs the lock. The shell honours `globalThis.__MOONVEIL_SCENE = 'off'` (set by every check's init script) and skips the mount; `low` / `high` pass through to the scene. Stub checks run scene-off by default (`SCENE=on` only under the lock); layout and real-server checks are always scene-off; captures are scene-on and need the lock. Each run prints `[scene] …`.

## Checks (this branch)
- `node scripts/env.mjs node apps/web/src/ui/dev/check.mjs` (vite on 4401): 30 interaction checks on the stub in Chromium headless shell: night submit/change, panel uniformity, seer result, witch heal, own-ballot-only votes, confirm→close, Hunter lock, ghost/living chat isolation in the DOM, chat send, reconnect overlay, role card hidden-until-tap, moderator close step + Yes count, full automatic match with bots to `ended`, no page errors.
- `apps/web/src/ui/dev/capture.mjs`: screenshots (phone 390×844 @2x, landscape 844×390, laptop 1440×900; WebKit iPhone 13 emulation for three). All browser emulation.
- `apps/web/src/ui/dev/real-check.mjs` (real engine on 4460, scene off): 75 checks incl. a deterministic night-1 death (all wolves pick one target, guard protects another, witch declines) so the ghost path (ghost bar, ghost skin, ghosts channel, living seats get no ghost frames/DOM) is proven every run.

## Approved product decisions (2026-10-16)
- Language: follows the browser (`vi` → Tiếng Việt, else English), switchable in Entry/Lobby/Settings, remembered on the device.
- In-person rooms: in-game voice off, wolves use private text at night. UI follows the server `voiceMode` flag (PROPOSALS.md P3; until it ships the stub default is `remote`).
- Night roles without an action: plain waiting panel, same shape for every role. No suspect-notes feature.
- Batch A: players 7–15 (lobby range and help read `view.limits` from the engine); decks come from the engine config (2 Wolves at 7–12, 3 at 13–15, one Seer/Witch/Guard/Hunter); the UI shows the dealt deck from `roleCounts` after start and never hard-codes counts.

## Approved: stalemate draw and moderator end (rules-12 5def39a, read via `game/approved.ts`)
- Stalemate: banner in the dock + toast when the engine publishes its warning (after 2 idle cycles); end screen "Draw: no one died for three cycles" with the full reveal.
- Moderator end: separate card in the console (moderator mode only), two steps: "End match…" → type END → "End the match now"; cancel anywhere. Never shown to players or a playing host. End screen "Ended by the moderator", no winner, full reveal. The old provisional abort button is gone.

## Provisional, behind settings / config (pending Human decisions)
- Moderator narration cues: Settings → "Narration cues", default off.
- Remove / abort: hidden; appear only when the rules config carries `moderator.canRemove` / `moderator.canAbort`.

## Voice (foundation-6)
`client.ts` owns the one `VoiceClient` (lazy, `__moonveil.voice`). The UI reads its snapshot through `Session.voice()` (`ui/voice/useVoiceClient.ts`): mic state, mute, denied/failed, autoplay unlock. No second instance; the local getUserMedia check (`ui/voice/mic.ts`) is used only when no VoiceClient exists (in-person rooms, stub).

## Host deck (foundation-6, P12)
Lobby `DeckCard` renders `view.deck` (engine default for the player count, host custom counts, engine validation error; start is blocked on error). Host: Customize (± per role) → Apply (`{t:'deck', counts}`), Use default (`counts: null`). Counts and roles come from the engine, never hard-coded.

## Look editor (approved UX)
Costume picker (ADR 0011 contract): `ui/components/LookPicker.tsx` in the lobby editor and on the entry screen. Outfit chips → style chips (variants) → colour swatches → headgear / front / back selects; a control shows only when the outfit offers more than one choice. Every list comes from `OUTFITS` (protocol appearance.ts) through `game/look.ts`: a new outfit or option appears with no picker change. Names: i18n `lookNames` (outfit and style names en/vi from docs/visual/themes/CATALOG.md "Display names"; headgear/accessory/colour names are UI copy), else the humanized id. The draft is the canonical CostumeAppearance; the editor opens on the seat's real look (no legacy reset); Save sends the canonical form; the scene preview uses `sceneAppearance(draft, seat)`. `invalid-appearance` → localized error + the "not saved" notice, saved look shown. Looks change only in the lobby (server rule; no editor in the match). Entry stores the profile as entered: an untouched legacy look stays legacy so the server keeps the seat-seeded camper extras. Cosmetic only, never a role; no random, unlocks or economy. Proof: stub 11l, `ui/dev/picker-check.mjs` (real server).
Draft store `game/look-draft.ts`: each colour/hat change previews on the You card, the own list entry and the own scene avatar (scene `setLocalAppearanceOverride`, MOUNT.md; `debugAppearance` read hook only when the check environment sets `__MOONVEIL_SCENE_DEBUG`, never in production); nothing is sent until Save. Cancel, closing the editor or Escape clear it. Save sends the profile and keeps the preview until a snapshot carries the same appearance (then cleared); a rejection, or no matching snapshot within 6 s, clears it and shows "Your look was not saved. Showing your saved look." Reconnect, a seat/room change, leaving the lobby or the match starting discard the draft. Two-seat scene-on proof: `ui/dev/look-check.mjs` (heavy).

## Chat overlay (always visible)
Root cause of "who said what": the old chat named the sender only as a same-coloured word run into the text (nothing tied it to the seat's look in the camp or seat grid), inside a sheet behind an icon with no arrival signal. Now each message resolves once to its sender seat (`senderOf`: name AND avatar from `msg.from`, never `msg.name` next to another seat's look), on its own line, in an always-visible box. The chat sheet (full history) uses the same `ChatLine`.
- `ui/components/ChatOverlay.tsx`, bottom-left of the scene host (above the dock, below the top bar), lobby + match. Channel label when the seat hears several channels or the channel is not public. New message: slide-in + brief highlight, no sound.
- Laptop / large host: last 4 messages, inline input (live only with a speak grant) + History. Compact (host < 560 px wide or < 600 px tall = phones): one 44 px row = latest message (name line + text, 2 lines when the host is ≥ 400 px tall, else 1) + 💬 button opening the sheet (history + input). Writing on phones is in the sheet (keyboard-safe, focus trapped, returns focus).
- Same box for every seat: size/position depend only on the host size (fixed log height, reserved laptop input row), never on messages or grants. Renders only `s.chat` (server-filtered, listen-granted channels).
- Scene: translucent background, no blur (scene shows through), text shadow; contrast measured over the rendered scene. Campfire circle: the camera frames the whole camp, leaving 25.7 % of the frame below the seat ring; the phone row fits there, so the camp keeps its size. `SceneMount` passes the box as `setSafeArea({ bottom })` only when it would not fit (compact: covering more than 25 % of the uncovered height, e.g. keyboard open or 375×667; laptop corner box: ≥ 40 % of the width or ≥ 30 % of the height). `scene-slot[data-safe-bottom]` shows the value.
- Proofs: `ui/dev/chat-check.mjs` (real server, heavy, ~7 min): sender seat = name = avatar, isolation incl. reload, identical wolf/non-wolf box at three viewports, overlap incl. keyboard, typing (overlay and sheet input), contrast day/night, campfire seats clear (camera from the scene's `tap` event + `createMap`) at phone 390×844 / 375×667 / landscape and laptop 1440×900 / 1366×768 / 1280×720, discussion and vote. Stub `check.mjs` 11k.

## Scene mount (docs/visual/MOUNT.md, adopted)
`ui/SceneMount.tsx` mounts `@moonveil/scene` into `.scene-slot` in lobby and match: `toSceneInput(view, gameView)` on every snapshot, `setSpeaking` from the `speaking` frame, `setPoses(fromWirePoses(.., 'normalized'))` from `poses` frames, `on('move')` → `{t:'move'}`, `setSafeArea({top})` from the measured top bar, `setAudio` from Settings → "Camp ambience" (default off; starts after a gesture). Decisions for visual: (1) poses/speaking live in `SessionState` (client adapter taps the socket until foundation adds a hook, P2); (2) top bar height measured; (3) avatar taps ignored in v1; (4) ambience toggle in Settings, default off.

## Not in this increment
- Scene canvas mount (`scene-slot` is reserved; `packages/scene` lands via INTEGRATION.md).
- Real voice (mic hook proves capture; LiveKit adapter is voice scope).
- Server wiring: see PROPOSALS.md. E2E on the real server after foundation ships P1–P3.
