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

## Accessibility and layout
- Touch targets ≥ 44 px (`--tap`), focus rings, `aria-pressed` on choices, `role=timer`, `aria-live` status lines, dialog semantics on sheets, Escape closes.
- Reduced motion: system preference or setting zeroes all durations.
- Phone portrait: scene top, dock bottom (≤ 62 % height, scrolls). Phone landscape / laptop (≥ 700 px, landscape): scene left, dock right (420–440 px).
- Contrast: ink on surfaces ≥ 7:1 in both skins (tokens chosen for it; verify after theme decision).

## Uniformity guards (night) and residual tells
- Same panel structure for every role (checked: `panel-head>hint>info-slot>seat-grid>btn-row>muted` on villager, seer, guard, wolf).
- Top bar: same button count for every seat at night; mic button neutral and label-less at night; chat button always present (a seat with no listen grant gets an empty "quiet" sheet, no channel named).
- Seat grid tags roles only when publicly revealed (Hunter turn) or at match end; own role and pack live in the role card (tap to reveal).
- Residual: a wolf's mic tap toggles the glyph; the Witch panel has heal buttons in the info slot (same slot height). In in-person rooms voice is off, which removes the mic tell where glancing is possible.
- Not covered here: wire traffic (PROPOSALS.md P10) and voice-provider metadata (voice scope).

## Layout and accessibility checks
`node scripts/env.mjs node apps/web/src/ui/dev/layout-check.mjs --webkit` (vite on 4401): every scenario and sheet at phone portrait 390×844, phone landscape 844×390 and laptop 1440×900 in Chromium headless shell, plus iPhone 13 portrait/landscape in WebKit (all emulation). Asserts no horizontal overflow (document, dock, lobby, sheets), visible text ≥ 13 px, interactive targets ≥ 44 px (icons/swatches ≥ 40; label-wrapped checkboxes measured by their label), text contrast ≥ 4.5:1 against its composited surface (3:1 for large text; text over the scene/top bar excluded, it has shadows), bottom padding floor for safe areas, and the primary button fully inside the viewport after scrolling the dock. 170/170.
Fixes it drove: `--fs-0` 0.85rem, 24 px checkboxes with 44 px label rows, 44 px selects, lighter muted/team/ghost tokens (ink-3, wolves, village, ghost) for contrast.

## Polish (theme layer only)
Dock panel re-enters on every step instance (keyed by step/night/day); announcements fade in and out; timer pulses under 10 s; picked chip pops; confirm turns into a green "Chosen" state with a ✓ status line; haptic tick on confirms (`navigator.vibrate` where available); all motion off under reduced motion. Microcopy: "Chosen. You can still change it until dawn.", "You have not voted yet", consistent night copy in vi/en.

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

## Scene mount (docs/visual/MOUNT.md, adopted)
`ui/SceneMount.tsx` mounts `@moonveil/scene` into `.scene-slot` in lobby and match: `toSceneInput(view, gameView)` on every snapshot, `setSpeaking` from the `speaking` frame, `setPoses(fromWirePoses(.., 'normalized'))` from `poses` frames, `on('move')` → `{t:'move'}`, `setSafeArea({top})` from the measured top bar, `setAudio` from Settings → "Camp ambience" (default off; starts after a gesture). Decisions for visual: (1) poses/speaking live in `SessionState` (client adapter taps the socket until foundation adds a hook, P2); (2) top bar height measured; (3) avatar taps ignored in v1; (4) ambience toggle in Settings, default off.

## Not in this increment
- Scene canvas mount (`scene-slot` is reserved; `packages/scene` lands via INTEGRATION.md).
- Real voice (mic hook proves capture; LiveKit adapter is voice scope).
- Server wiring: see PROPOSALS.md. E2E on the real server after foundation ships P1–P3.
