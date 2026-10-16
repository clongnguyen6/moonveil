# Game UI: screen map and flow

Owner: game-ui (`apps/web/src/game/**`, `apps/web/src/ui/**`). Status: built against the in-browser stub
(`src/game/stub`, runs the real `@moonveil/rules` engine); server wiring pending (docs/ui/PROPOSALS.md).
Run: `WEB_PORT=4401 node scripts/env.mjs npm run dev -w @moonveil/web` → `http://127.0.0.1:4401/src/ui/dev/index.html?scenario=<name>&lang=vi|en`.
Captures: `docs/ui/screens/` (browser emulation only; `apps/web/src/ui/dev/capture.mjs`).

## Principles (binding)
- Render only `SeatView` + the seat's `Projection`. No inference, caching or client filtering of secrets. Facts shown = `me.facts`; menus = `me.actions`.
- Approved rules are copy only (help text). Everything else (timers, targets, potions, who may vote) comes from the projection/actions, so a rules change needs no UI change.
- Night: one panel layout for every role (head · task · info slot · seat grid · two buttons · status line). Roles without an action get a private note task of the same shape. The panel never ends a step; the timer is the server deadline.
- Votes: own ballot only. No tallies, no "x of y voted". Results come from the public log at close.
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
                 others / dead → NotePanel (same frame)
    night.witch  witch → WitchPanel (victim line, heal yes/no, poison grid)   others → NotePanel
    hunter       pending hunter → HunterPanel (shoot/pass)   others → wait panel (hunter named)
    day.discussion → DiscussionPanel (seats, speaking rings, private note tags)
    day.vote       → VotePanel (grid + Skip/Confirm, own vote line)
    day.defense    → DefensePanel (accused; speak rights by grant)
    day.confirm    → ConfirmPanel (Yes/No, own ballot line, living count)
    ended          → EndPanel (winner, reason, all roles, history if provided, leave)
  ghost bar (dead seat): cause, ghost hint or Hunter-pending isolation note; skin → ghost
  moderator (kind=moderator): ModeratorConsole replaces the dock: Step (close step, Yes-count entry on day.confirm, abort) · Seats (roles, remove) · Night record · Log
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
| day.vote | grid, Skip, Confirm | own vote changeable until close | toast at close: trial / no trial |
| day.defense | accused card | accused speaks (grant) | — |
| day.confirm | Yes / No | own ballot changeable until close | toast: Yes/No counts; overlay: executed |
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

## Checks (this branch)
- `node scripts/env.mjs node apps/web/src/ui/dev/check.mjs` (vite on 4401): 29 interaction checks on the stub in Chromium headless shell: night submit/change, panel uniformity, seer result, witch heal, own-ballot-only votes, confirm→close, Hunter lock, ghost/living chat isolation in the DOM, chat send, reconnect overlay, role card hidden-until-tap, moderator close step + Yes count, full automatic match with bots to `ended`, no page errors.
- `apps/web/src/ui/dev/capture.mjs`: screenshots (phone 390×844 @2x, landscape 844×390, laptop 1440×900; WebKit iPhone 13 emulation for three). All browser emulation.
- Root `npm run typecheck`, `npm test` pass on the branch (rules 183/183, server 20/20).

## Language
Default proposal: UI follows the browser language (`vi` → Tiếng Việt, else English), switchable in Entry/Lobby/Settings and remembered on the device. Both tables are complete (`ui/i18n/en.ts`, `vi.ts`).

## Not in this increment
- Scene canvas mount (`scene-slot` is reserved; `packages/scene` lands via INTEGRATION.md).
- Real voice (mic hook proves capture; LiveKit adapter is voice scope).
- Server wiring: see PROPOSALS.md. E2E on the real server after foundation ships P1–P3.
