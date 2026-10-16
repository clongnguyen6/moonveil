# Moonveil room state

Maintained by Lead (93ca0cd6-c546-456f-b97f-c3c9c4115a14). Peers: read, don't edit. Authoritative product decisions: PROJECT_BRIEF.md.

## Git
- Commit/push/PR allowed. ANY merge (incl. ff of scope branch into `dev` or `main`) and any deployment need explicit Human approval. No cherry-pick/other workaround.
- `dev` = init commit acf85a0 (docs). Scope work: commit + push on own branch `<scope>` in `.worktrees/<scope>`; rebasing own branch onto dev is fine.
- Integration into `dev`: held. Lead brings a concrete integration proposal or a scoped standing-permission request to Human.
- Main checkout stays clean; only Lead commits ROOM_STATE.md there.

## Grants
Human, 2026-10-16. Exact text in WORKSPACE_PROTOCOL.md "Approved grants (2026-10-16)". Do not widen. Where lines below still show these items as pending/held, these grants apply.
- **a. Cleanup.** Uninstalling Homebrew formula `livekit` and deleting `/tmp/null` is authorized, but only after a narrow check that the reported state still holds and nothing has started depending on them. Not included: `brew cleanup`, shared npm/npx caches, npm logs, other system paths. Shared caches stay. The voice owner performs this.
- **b. WebKit testing.** Playwright may write only to `~/Library/Preferences/org.webkit.Playwright.plist`, `~/Library/WebKit/org.webkit.Playwright/` and `~/Library/Caches/org.webkit.Playwright/`. Every other cache stays repo-local. No general system-install, certificate or home-directory write permission. Results are labelled "WebKit/browser emulation", not real iPhone validation.
- **c. Standing dev integration.** Fast-forward-only merges of scope branches into `dev` are allowed, performed by the owner after Human reviews scope and ownership. The owner's meaningful checks must pass on the exact final SHA, after any rebase. Each merge and its evidence gets logged. No force-push or destructive rewrite of shared branches. Merges into `main` and every deployment still need separate explicit approval. Revocable.
- **d. Voice.** LiveKit OSS is selected for implementation and local verification only. Zero licence cost is not zero operating cost. Hosting, TURN, service costs, sign-ups, certificate installation and deployment remain unapproved.

## Owners (one per changing scope)
| Scope | Owner agent | Paths | Ports |
|---|---|---|---|
| foundation: init, root tooling, server, web shell, protocol, e2e harness | 46b279f0 | root config, apps/*, packages/protocol, e2e/, docs/architecture | 4100–4199 |
| rules: proposal + pure engine | fd99d2a9 | packages/rules, docs/rules | — |
| visual preview | d9e8c62b | preview/, docs/visual | 4200–4299 |
| voice investigation | 87bbae25 | spikes/voice, docs/voice | 4300–4399 |
| review (read-only): rules 9af74b8 | 09a95d56 (codex) | none | — |

## Milestones
- M0 init: docs committed on `dev` (acf85a0). [done]
- M1 visual preview → Human approval before broad visual production. [in progress]
- M1 rule proposal: rules 9af74b8, 15 product decisions + low-stakes batch. Lead re-ran check: typecheck ok, 115/115. Independent review running; then to Human. Rules Peer now: balance sim, TS7 alignment, narration draft.
- M1 voice recommendation: self-hosted LiveKit OSS, room-per-channel, server sole token issuer, rotate channel on membership loss (OSS doesn't revoke tokens). 43/43 checks on voice a94fe73 (Peer-reported; Lead re-run pending). Hosted options need sign-ups → Human. [reported upstream]
- M2 playable vertical slice: full automatic + moderator match, server-side isolation, reconnect, 7–10 browser sessions. [blocked on M1 rules decisions for final rules; engine uses provisional defaults]
- M3 production visuals/audio/animation/UI (after preview approval) + voice integration.
- M4 acceptance: full matches both modes, isolation, ghosts, reconnect, phone/laptop emulation; exact revision + limits reported; merge/deploy request.

## Decisions (Lead, technical, open to challenge)
- Current design: TypeScript end to end, server-authoritative; clients receive only seat-entitled info.
- Voice permissions enforced server-side; provider undecided (LiveKit candidate only).
- Unresolved gameplay may be explored only as clearly provisional, isolated prototypes; never accepted production rules without Human approval.

## Pending Human decisions
- Standing permission to ff-merge scope branches into `dev` (not main) after owner checks + Lead diff review? [pending, NOT approved]
- Rollback: `brew uninstall livekit` (1.13.10, no deps/services) + delete 3 npm logs, 3 org.webkit.Playwright paths, /tmp/null. [proposed to Supervisor]
- Integration of foundation b3d9ece into dev (ff from dev b210c4d). [proposed to Supervisor]
- Blocked by merge hold: server↔rules wiring (needs rules pkg in workspace), voice integration.
- Other outside-Moonveil writes + rollback (see Risks). [proposed to Supervisor]
- WebKit/iOS emulation needs ~/Library writes: approve, or accept Chromium-only emulation. [proposed]
- Phone LAN mic/voice needs HTTPS with trusted cert (getUserMedia secure-context). Hosting/device-trust decision with voice. [open]
- Coming: rules proposal, preview approval, voice provider/cost.

## Risks / notes
- Some web doc fetches are being rejected by the permission system; Peers source claims locally and label provenance; don't retry denied calls.
- Outside writes by foundation (2026-10-16): ~/.npm/_npx/e41f203b7505f1fb (rewritten), ~/.npm/_cacache (8 files), 3 ~/.npm/_logs files (07_05_07, 07_09_58, 07_10_05), /tmp/.mv_marker_never_used (created+deleted), WebKit: ~/Library/{Preferences/org.webkit.Playwright.plist, WebKit/org.webkit.Playwright/, Caches/org.webkit.Playwright/}, ~/Library/Caches/com.apple.nsservicescache.plist recreated. Not undone.
- Outside write by rules: /tmp/x (created+deleted 14:31). ~/.npm/_logs 07_05_55 + ~/.npm/_npx playwright 1.64.1 + _cacache = voice. 07_05_15 (npm ls --global) unattributed (asking visual).
- Outside writes by voice (besides brew): Homebrew bottle in ~/Library/Caches/Homebrew; /tmp/voice-results.txt; probable Go telemetry in ~/Library/Application Support/go/telemetry; Playwright temp profiles in OS temp (normally auto-removed). Not undone.
- Outside write by Lead: /tmp/null (331 B, npm ci output) 14:31, command mistake. Not undone.
- Foundation repo scripts now pin caches/tmp/browsers to .cache/ (verified: no new ~/.npm logs on check run).
- Open from foundation: ghost knowledge wording ambiguous (→ rules); fixed-length secret phases = pace vs timing-secrecy (→ rules); rooms in memory (restart loses); no mode/moderator change after creation.
- INCIDENT: Voice Peer installed livekit-server system-wide via Homebrew. Outside existing authorization (WORKSPACE_PROTOCOL already limited writes to Moonveil). Pending: Peer's exact report (command/time, packages, running services, rollback + shared-machine impact) in docs/voice/INSTALL_INCIDENT.md. No uninstall, service stop or other outside-repo change without Human approval. Tools stay inside Moonveil.

## Acceptance evidence
- foundation b3d9ece: Lead re-ran `node scripts/env.mjs npm run check` 14:31 → typecheck ok, server 10/10, e2e 7/7 (8-browser auto isolation, 7+mod isolation, lobby, reconnect, 2nd tab, Pixel 7 emu). Chromium only. No new ~/.npm logs. Not integrated (merge held).
