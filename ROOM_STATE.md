# Moonveil room state

Maintained by Lead (93ca0cd6-c546-456f-b97f-c3c9c4115a14). Peers: read, don't edit. Authoritative product decisions: PROJECT_BRIEF.md.

## Git
- Commit/push/PR allowed. Merges into `main` and every deployment need separate explicit Human approval. No cherry-pick/other workaround.
- Scope work: commit + push on own branch in `.worktrees/<scope>`. No force-push, including own branches. To pick up `dev` on an already-pushed branch, merge `dev` into it (no rebase).
- Integration into `dev` (grant c): owner Peer fast-forwards (`--ff-only`) after Lead reviews scope and ownership; owner's meaningful checks pass on the exact final SHA; entry added to Merge log.
- Keep the main checkout clean.

## Grants
Human, 2026-10-16. Same text as WORKSPACE_PROTOCOL.md "Approved grants (2026-10-16)". Do not widen.
- **a. Cleanup.** Uninstalling Homebrew formula `livekit` and deleting `/tmp/null` is authorized, but only after a narrow check that the reported state still holds and nothing has started depending on them. Not included: `brew cleanup`, shared npm/npx caches, npm logs, other system paths. Shared caches stay. The voice owner performs this. WebKit artifacts listed under grant b are kept (they are covered by that testing exception). Do not claim restoration of unrecoverable prior cache state.
- **b. WebKit testing.** Playwright may write only to `~/Library/Preferences/org.webkit.Playwright.plist`, `~/Library/WebKit/org.webkit.Playwright/` and `~/Library/Caches/org.webkit.Playwright/`. Every other cache stays repo-local. No general system-install, certificate or home-directory write permission. Results are labelled "WebKit/browser emulation", not real iPhone validation.
- **c. Standing dev integration.** Fast-forward-only merges of scope branches into `dev` are allowed, performed by the owner Peer after Lead reviews scope and ownership. The owner's meaningful checks must pass on the exact final SHA, after any rebase. Each merge and its evidence gets logged. No force-push or destructive rewrite of shared branches. Merges into `main` and every deployment still need separate explicit approval. Revocable.
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
- Voice permissions enforced server-side. LiveKit OSS selected for local implementation/verification; hosting/TURN/cost/certs/deploy still unapproved (grant d).
- Unresolved gameplay may be explored only as clearly provisional, isolated prototypes; never accepted production rules without Human approval.

## Pending Human decisions
- Standing permission to ff-merge scope branches into `dev` (not main). [approved 2026-10-16, grant c]
- Rollback. [approved 2026-10-16 as narrowed by grant a: `brew uninstall livekit` + delete /tmp/null only, after a narrow check, by voice owner. npm logs and shared caches stay; WebKit artifacts kept.]
- Integration of foundation into dev. [approved 2026-10-16; see Merge log]
- Server↔rules wiring needs the rules package merged into `dev` (grant c); voice integration per grant d.
- Other outside-Moonveil writes. [approved 2026-10-16 per grant a: shared caches and npm logs stay; no claim of restoring prior cache state]
- WebKit emulation ~/Library writes. [approved 2026-10-16, grant b: 3 org.webkit.Playwright paths only; label "WebKit/browser emulation"]
- Phone LAN mic/voice needs HTTPS with trusted cert (getUserMedia secure-context). Hosting/device-trust decision with voice. [open]
- Voice: LiveKit OSS selected for local implementation/verification; hosting/TURN/cost/certs/deploy still unapproved. [grant d]
- Coming: rules proposal, preview approval.

## Risks / notes
- Some web doc fetches are being rejected by the permission system; Peers source claims locally and label provenance; don't retry denied calls.
- Outside writes by foundation (2026-10-16): ~/.npm/_npx/e41f203b7505f1fb (rewritten), ~/.npm/_cacache (8 files), 3 ~/.npm/_logs files (07_05_07, 07_09_58, 07_10_05), /tmp/.mv_marker_never_used (created+deleted), WebKit: ~/Library/{Preferences/org.webkit.Playwright.plist, WebKit/org.webkit.Playwright/, Caches/org.webkit.Playwright/}, Not undone. (nsservicescache.plist attribution withdrawn: system rewrites it independently, observed 14:44:52/14:44:58 with no browser running.)
- Outside write by rules: /tmp/x (created+deleted 14:31). ~/.npm/_logs 07_05_55 + ~/.npm/_npx playwright 1.64.1 + _cacache = voice. 07_05_15 (npm ls --global) unattributed (asking visual).
- Outside writes by voice (besides brew): Homebrew bottle in ~/Library/Caches/Homebrew; /tmp/voice-results.txt; probable Go telemetry in ~/Library/Application Support/go/telemetry; Playwright temp profiles in OS temp (normally auto-removed). Not undone.
- Outside write by Lead: /tmp/null (331 B, npm ci output) 14:31, command mistake. Not undone.
- Foundation repo scripts now pin caches/tmp/browsers to .cache/ (verified: no new ~/.npm logs on check run).
- Open from foundation: ghost knowledge wording ambiguous (→ rules); fixed-length secret phases = pace vs timing-secrecy (→ rules); rooms in memory (restart loses); no mode/moderator change after creation.
- OPEN BUG (foundation, in merged dev): silent network (no close) never reconnects until the link returns; client watchdog calls `ws.close()` and waits for an `onclose` that a dead link doesn't deliver (observed: client "open" 36 s+, server drops seat ~26 s). Fix next on `foundation-2`, with its own checks.
- INCIDENT: Voice Peer installed livekit-server system-wide via Homebrew. Outside existing authorization (WORKSPACE_PROTOCOL already limited writes to Moonveil). Pending: Peer's exact report (command/time, packages, running services, rollback + shared-machine impact) in docs/voice/INSTALL_INCIDENT.md. Rollback now authorized by grant a (voice owner, after narrow check); nothing beyond it. Tools stay inside Moonveil.

## Merge log
Grant c merges into `dev`, newest last. Format: date · branch · ff from → head · checks on exact SHA.
- 2026-10-16 · foundation · ff 0d17f46 → head = the commit adding this entry (parent 0f6a0d6; this commit only adds this log). Reviewed by Human/Lead: 09b33e2 scope + ownership. Checks (foundation owner, clean `node_modules`): `node scripts/env.mjs npm ci` ok; `npm run e2e:install` ok; `npm run check` exit 0 = typecheck clean (4 workspaces), server 10/10, e2e 8/8 (desktop-chromium 6, mobile-chromium Pixel 7 1, mobile-webkit iPhone 15 1 = WebKit/browser emulation). Run on 0f6a0d6 14:48–14:49 and re-run on head before ff. Known open bug: silent-network reconnect (see Risks).

## Acceptance evidence
- foundation b3d9ece: Lead re-ran `node scripts/env.mjs npm run check` 14:31 → typecheck ok, server 10/10, e2e 7/7 (8-browser auto isolation, 7+mod isolation, lobby, reconnect, 2nd tab, Pixel 7 emu). Chromium only. No new ~/.npm logs. Superseded by the merged revision (see Merge log).
