# UX audit: Settings, create-room, lobby host controls (2026-10-18)

Walked as a first-time colleague, vi and en, phone and laptop (captures in `docs/ui/screens-ux/before` and `after`, scene off = light runs).

## Confusing points found (before)
1. **Settings sheet was a flat strip of mixed controls**: two selects and three checkboxes wrapped on one line, no sections, no explanation. "Âm báo: Tắt" (a select for on/off), "Hiệu ứng: Theo thiết bị" (what effect? what device?), "Cảnh trại" (a checkbox with no hint), "Âm thanh trại", and "Gợi ý lời dẫn (tạm thời)" shown to every player although it only affects the moderator.
2. **Personal vs room settings not separated**: the same strip sat at the bottom of the entry page and the lobby next to host controls, so "settings" read as room settings.
3. **Create-room**: the in-person checkbox ("We are in one room…") sat between "or start a new room" and the two create buttons; it was not clear it applied to both buttons, nor what "remote" means.
4. **Lobby host controls scattered**: invite link, then a separate QR card, then a voice-mode card with two long button labels, then players, then the deck card, then the mic card, then Ready/Start/Edit look/Leave in one card, then the settings strip. Nothing said which controls are the host's.
5. **Voice mode labels** "Remote (in-game voice)" / "In person (voice off)" read as technical; no line about echo or wolves' text.
6. **Deck card** had no line explaining where the numbers come from.
7. **Start gating** showed only "Waiting for everyone to be ready" without saying what else blocks it (deck validity).

## Changes (after), reversible, same look
| Screen | Change | Rationale |
|---|---|---|
| Settings sheet | Two groups: **Your settings** (language, sound cues, show the camp scene, camp sounds, animations) with one plain line each, on/off as switches; **Moderator** group (narration cues) shown to moderators only | Outcome-oriented labels; personal vs role controls; fewer control types |
| Entry | Language only at the bottom; settings live in the sheet once in a room | Removes the misread "room settings" strip |
| Create-room | "Start a new room" card: **Where are you playing?** radio (Online, voices in the game / Together in one room, voice off) with one line each, then the two create buttons | Makes the in-person choice apply visibly to both buttons and say its consequence |
| Lobby | Five cards in order: **Invite players** (code, copy, QR), **Room settings** (host; voice mode as radio with lines, deck with line; non-hosts see a read-only **Room** summary), **Players**, **You** (Ready, Edit look, Leave) + voice card, **Start** (host; line says what gates it) | Related controls grouped; host-only clearly labelled; critical controls stay visible |
| Defense (item 2) | Copy follows the server grant: with a public speak grant for living players it says "Everyone may speak. {name} has the floor."; otherwise the current "listen" line. Mic state already follows grants | Ready for the rules change without a further UI change |

Hooks unchanged (SELECTORS.md): `lang`, `voice-mode-remote/inperson` (now radios), `deck-*`, `qr`, `ready`, `start`, `edit-profile`, `leave`, `voice-join/leave`, `in-person`; new: `open-settings`, `settings-personal`, `settings-moderator`, `set-*`, `where-online`, `invite`, `room-settings[data-host]`, `room-voice-mode`, `you-card`, `start-card`, `defense-hint`.

## Not changed (would need a decision)
- Nothing here changes a rule or adds a power. The narration-cue switch stays moderator-only and on by default (D6).
