# Playtest-readiness pass (game UI, 2026-10-17)

Walked the main flow as colleagues will meet it, on the stub and the dev preview (44fb793 at 127.0.0.1:4480). Look unchanged.

## Flow walkthrough and what was fixed

| Moment | What a player sees | Fixed in this candidate | Still open |
|---|---|---|---|
| Invite link on a phone (`/r/CODE`) | Entry with name + look; code prefilled | "You are invited to room CODE" framing; the code field is hidden on a link (no second thing to type) | D1 |
| Wrong / expired link, full room, match already started, name taken | Server error text (English, terse) | Localized, player-facing copy for every server code (`ui/errors.ts`); engine rule messages pass through | — |
| Mic permission | Remote rooms with voice: the VoiceClient asks for the mic when the first speak session arrives; denied → "Microphone blocked… or play by text", Try again = reload; no voice backend → local "Check microphone" button with a level meter | — (already in place) | D2, D3 |
| Join mid-lobby | Lobby with the current players, ready states, deck card, invite link | — | — |
| Room full / started | Entry error (localized now); nothing else to do | — | D4 |
| Reconnect after locking the phone | Overlay "Reconnecting… Your seat and progress are saved." then the same screen; after a server restart "saved and paused…" (close 1012); wake lock re-requested when visible | — (already in place) | — |
| In-person vs remote at creation | Checkbox "We are in one room (voice off, wolves text at night)" on the create screen; lobby mic card explains in-person | — | D5 |
| Moderator on a laptop | Console: Step tab with Close step, a new **Now** card (dawn result, who is on trial, Hunter pending, public ballots live), Yes-count entry labelled for hand counts, End match with typed confirm; Seats / Night / Log tabs; chat listen-only | Now card; Yes-count hint | D6, D7 |

## Decisions (Human, 2026-10-17) and how they're built
- **D1 QR code**: on the host's lobby screen beside link and code. Vendored encoder `ui/qr.ts` (original Moonveil code, byte mode, EC level M, versions 1–10; no dependency). Verified by a structural read-back self-test (`ui/dev/qr-selftest.mjs`: reader-order format bits, reserved map, Reed–Solomon syndromes, payload), not by a camera: **please scan it with a phone at the playtest**.
- **D2 Join voice**: nothing connects and no mic prompt until the player taps Join voice (lobby mic card, or the mic button in the match top bar). Then mute/unmute and Leave voice. In-person rooms show no Join voice. The client/voice side (P16: `client.joinVoice()/leaveVoice()`, `ClientState.voiceJoined`) is foundation's and voice's; the UI feature-detects it.
- **D3 Mic denial guidance**: one line per platform (iOS Safari, Android Chrome, desktop Chrome/Edge, desktop Safari, Firefox, other) from the UA, under the denied/failed state.
- **D4**: clear errors only for a full or already-started room; no spectator mode.
- **D5 Voice mode switch**: host only, lobby only; everyone's view follows the server; remote → in person drops voice for everyone (server/voice). Message `{ t: 'voiceMode', voiceMode }` (P17, foundation).
- **D6 Narration cues**: on by default for the moderator; lines from `docs/rules/NARRATION.md` (rules-13 2ea3952): approved-consistent lines, the neutral N7 line for the second night step, M1–M3 as the action cues; `{t}`, `{need}`, `{living}` come from the engine, never hard-coded. The Vietnamese narration is a draft that still needs a native read-through (rules owner's note).

## Product decisions needed (not guessed) — answered above; kept for the record
- **D1 Invite link copy and QR.** On LAN http the copy button falls back to a selectable link. A QR code on the host's laptop screen would make phone entry one scan; foundation's `/api/lan` exists. Decide whether to add it (new asset-free feature) or keep link/code only.
- **D2 Mic prompt timing.** The browser mic prompt appears on lobby entry (first speak session), not from a tap. On iOS Safari this can be refused silently. Alternative: ask only after a "Join voice" tap in the lobby. Voice/foundation own the acquisition; the UI can host the tap.
- **D3 Denied mic recovery.** Today: "Try again" reloads the page. Decide whether to add per-browser instructions (Safari/Chrome/Android) or keep the generic line.
- **D4 Full room / started match.** Players get an error and stay on the entry screen. Decide: spectator seat (engine has a `public` viewer), a waiting message that auto-joins the next lobby, or keep the error.
- **D5 Changing voice mode after creation.** Fixed at creation today (server). Decide whether the host may flip in-person/remote in the lobby.
- **D6 Narration cues for the moderator.** `docs/rules/NARRATION.md` texts exist; the console shows cue lines only when Settings → "Narration cues" is on (provisional). For a moderator running from a laptop this is the main aid. Decide: default on for moderators, using the rules narration text.
- **D7 Moderator speaking.** Grants give the moderator listen-only (approved). A moderator narrating remotely over voice cannot be heard in-app; in-person they speak at the table. Decide if remote moderated matches need a speak grant for the moderator (rules `moderator.speaksInPublic`).
- **D8 Server error language.** Engine rule messages (e.g. "cannot target yourself") are shown verbatim in English. Decide whether the engine should emit codes the UI localizes, or keep English for these rare cases.

## Readability notes kept as is (no decision needed)
- Night panels for roles without an action show blank buttons by design (uniform frame).
- The "Keep your screen on" line shows only when the wake lock is unavailable.
