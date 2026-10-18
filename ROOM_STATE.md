# Moonveil room state

Maintained by Lead (93ca0cd6-c546-456f-b97f-c3c9c4115a14). Peers: read, don't edit. Authoritative product decisions: PROJECT_BRIEF.md.

## Git
- Commit/push/PR allowed. Merges into `main` and every deployment need separate explicit Human approval. No cherry-pick/other workaround.
- Scope work: commit + push on own branch in `.worktrees/<scope>`. No force-push, including own branches. To pick up `dev` on an already-pushed branch, merge `dev` into it (no rebase).
- New workspace package: its owner adds only its own workspace entry + `scripts/env.mjs npm install` lockfile delta (additions only) in the creating commit, and it must pass root check there. Consumer manifests stay with their owners.
- Root e2e: each owner sets E2E_PORT inside its own range (default 4150 = foundation) until harness uses free ports.
- Messaging a running Peer interrupts its current tool call; batch non-urgent notes.
- Integration window (Lead serializes, one owner at a time; Lead makes no dev commit during a window): owner merges `origin/dev` into scope branch → candidate SHA → owner checks on that exact candidate → Lead review → "go" → owner fast-forwards dev.
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
| foundation: root tooling, server, protocol, client.ts/main.tsx/vite.config/web manifest, e2e harness | 46b279f0 | root config, apps/*, packages/protocol, e2e/, docs/architecture | 4100–4199 |
| rules: proposal + pure engine | fd99d2a9 | packages/rules, docs/rules | 4500–4599 (E2E_PORT for root check) |
| visual → scene (from ~10:10Z; d9e8c62b hit Fable model limit, handed over) | c4495920 | packages/scene, docs/visual (preview/ being retired) | 4200–4299 |
| game UI (from 2026-10-18 ~10:05Z; 990963ac hit model limit, handed over) | b5491460 | apps/web/src/game/**, apps/web/src/ui/**, App.tsx, styles.css, provisional/** (handed over), docs/ui; user-facing LAN helpers | 4400–4499 |
| voice (spike → product) | 87bbae25 | spikes/voice, docs/voice, packages/voice (new) | 4300–4399 |
| review (read-only, done): rules 9af74b8 | 09a95d56 (codex) | none | — |
| art-themes: costume creative/asset owner (Human chose Codex) | 69dc0d82 (codex) | docs/visual/themes/**; costume art code packages/scene/src/costumes/** (proposed) | ask Lead before scene rendering |

## Art themes (Human-approved 2026-10-18, concepts only)
- Six original themes: bow cat, robot cat, chubby fish (puffer/shark), camping frog, yellow duck, forest mushroom. Inspired-by, not replicas; appearance-only, role-independent; camping world kept.
- Working assumption (reversible): costumes/headgear on current base, not full-species. Open: puffer vs shark; costume vs species.
- First deliverable: concept sheet + phone-scale strip + layer/animation/route notes. Human reviews before final assets/integration. Planned UX: pick outfit, then customise, with local preview + Save/Cancel; no random button/unlocks/economy unless Human confirms.
- Integration later touches visual (scene), game UI (picker), foundation (protocol appearance schema).
- Delivered art-themes 17b1c75 (docs/visual/themes only; Lead reviewed images). Sent to Human for selection. Peer recommends: pufferfish hat (shark not drawn), keep procedural vector for production, generated rasters review-only. Seam: `extra` (one of none/scarf/backpack) and wire {color,hat} can't express these; appearance contract needed before production.
- Outside-Moonveil write (image tool auto-save, no output-dir control): /Users/long/.codex-runtime/peer/generated_images/01a14e4b-…/ 3 PNGs, 2,634,923 bytes. Not deleted; reported.

## LIVE 2026-10-18 15:16Z: f91f425 (deploy-trial = f91f425b3f65…)
- 2026-10-18 · deploy-trial · ff 3b1dbde → f91f425 (15:15:32Z) · Human-approved; push-triggered Railway build; /api/status revision f91f425 (RAILWAY_GIT_COMMIT_SHA; Lead watcher 15:16:57Z, both domains), volume, voice configured; test lobby XFF9YG (created on 3b1dbde, legacy looks) resumed (1012, ~16 s, same seats), upgraded to canonical campers with seeded extras; both origins ok, foreign + http refused; fresh www room VU67PV; look-check (legacy) and costume-check (duck/ring exact) ok. Evidence foundation .cache/postdeploy/deploy5/. Other rooms untouched; Human did not state whether games were active.
- Auto-deploy: ON for this deploy; Human asked to turn OFF (pending confirmation). restoredRooms/skippedRooms not supplied.
- Rollback to 3b1dbde (tested): f91f425 rooms restore; costumes show as campers; costume-wearers can't edit looks in those rooms until rejoin/forward deploy.
- Pending into dev: foundation-postdeploy b941bbd (postdeploy script --costume-check + --look-check).

## Release candidate f91f425 (2026-10-18)
- dev f91f425 = chat + costumes (contract, seam, adapter, 8 looks, picker) + small-phone framing + fire labels + stale-error fix + leave fix. FF from live 3b1dbde; STATE_VERSION 2.
- Full acceptance 14:14–15:02Z (foundation, exclusive lock): npm ci; check (467 unit, e2e 13/13); matches 10/10; voice 10/10; strict UI 16/16, 711/711, 0 misses (mitigations: 3 s click wait, one 4 fps observer). Summary foundation .cache/runs/full-f91f425/summary.txt.
- Deploy request sent to Supervisor 15:0xZ. Pending: Human approval; rollback compatibility (3b1dbde reading canonical-appearance snapshots) being checked by foundation; postdeploy costume broadcast check being added.

## Costumes production (Human-approved 2026-10-18; no deploy)
- Scope: all six themes + goofy shark + duck with/without ring (8 looks); more coherent variants later, no numeric target. Costumes on camper (reversible baseline). Picker: outfit → customise → local preview → Save/Cancel; no economy/unlocks; never role.
- Ownership: Codex = creative/catalog content + costume art code; visual = scene seam/pipeline; foundation = wire/server contract + restore compat; game UI = picker (after chat). Don't shift creative work to Claude seats.
- Phase 1 (now): foundation contract proposal (branch foundation-appearance, stop for review); visual seam + placeholder (visual-costumes); Codex CATALOG.md + shark design.
- Phase 1 results: contract proposal foundation-appearance c913147 (reviewed); catalog source art-themes 3776e4d CATALOG.md (fish choice = variant, fishHeadgear, finPouch, headgear-off `none`); seam visual-costumes af2afd2 (rig.ts; costumes/** handed to Codex). Decisions: legacy upgrade reproduces seeded scarf/backpack via @moonveil/scene/seed; variant change = appearance changed; whole-profile invalid-appearance; body not chosen this round. Foundation building; Codex building duck/ring on art-costumes from af2afd2.
- Seam 51431c8 (choices → pieces/crown/label/body colour; dev page ?outfit=…; costume tests in package check). Duck 7166772 on art-costumes (Codex merging seam next).
- Placeholder check done (visual-costumes 5ec35e6, docs/visual/costumes/). Visual integration window open (scene check + root check, no browser).
- Foundation contract built: foundation-appearance 3bc0e8a (includes visual-costumes 14c9dea). Catalog from CATALOG.md; invalid-appearance; legacy upgrade with seededExtras; STATE_VERSION 2 unchanged; restore tests from real 3b1dbde snapshots. One-off handover to foundation: 4 type-only UI call sites (local-room.ts:149, look-draft sameLook, components/index.tsx:15, Lobby.tsx:144). Order into dev: visual-costumes → foundation-appearance.
- Landed in dev: visual-costumes 7f387e5, game-ui-chat 896ea7e, foundation-appearance ac67e22 (dev 8e0ec78). Next: visual-adapter (rebase onto 8e0ec78), then art-costumes, then picker.
- Duck preview art-costumes 77cd386 (docs/visual/themes/preview-duck, 64 WebKit captures) sent to Human as in-progress: ring too thin at phone size, ring vs plain hard to tell; Codex fixing readability (+ other looks), short re-capture after.
- Open follow-ups: game UI (deterministic room 2, 3 consecutive real-check passes; landscape top bar; labelled no-action night placeholders) on game-ui-followups; visual small-phone framing (labels ~5 px at 375×667) after adapter.
- Note: e2e:matches is browser-based (7–10 headless Chromium pages, scene off), not Node-only.
- Model limits: Fable seats (old game UI, old visual) hit usage limits; replaced by Opus 5.5 seats. Voice 87bbae25 is also Fable (idle); re-seat if needed.
- Chat candidate 724ae36 (local, unpushed) NOT go: wrong avatar on a message (Bình shown with Chi's "CH"), phone box hides whole campfire circle (blur), root cause not stated. Laptop + isolation good.
- Phase 2: duck-with-ring + ghost in real scene (layering, seated, flip, label/ring clearance, phone/laptop day/night) = next Human preview.
- Phase 3: batch remaining looks + ghosts; picker; candidate checks; ff into dev. Deploy needs approval.

## Chat overlay (Human-approved 2026-10-18, implement + review, no deploy)
- Owner game UI 990963ac, branch game-ui-chat from dev. Persistent corner overlay (working default bottom-left), auto-visible recent messages, clear sender name + content + channel label, translucent bg with readable text, bounded history + full access, no overlap with joystick/vote/night actions/mic, safe areas/keyboard, typing never moves avatar.
- Fix the root cause of "can't tell who said what", not just relocation. Channel isolation unchanged (no previews/names/badges across channels, incl. night/reconnect); server change → foundation only if evidence requires.
- Evidence: before/after phone+laptop day/night shots; real-server multi-seat checks (auto-visible, unauthorized never shown, reconnect history, overlap, typing). Browser lock: game UI (art-themes asks first).

## Milestones
- M0 init: docs committed on `dev` (acf85a0). [done]
- M1 visual: mature redo SUPERSEDED (Human returned to original look, 2026-10-17). Baseline = original look (dev 44fb793, BASELINE.md). Option B: keep look, prioritise playtest readiness; polish deferred. Redo branches visual-6, game-ui-art unmerged.
- M1 rules: proposal v0.2 at rules 01fbb49 (codex review F1–F7 addressed; Lead re-ran 138/138) sent to Human. Approved so far listed under Approved rules; rest pending. Rules Peer: recording approvals + integration into dev.
- M1 voice: LiveKit OSS selected for local implementation/verification (grant d). Room-per-channel, server sole token issuer, rotate channel on membership loss. 43/43 on a94fe73 (Peer); reconcile with head + re-run on final SHA before merge. Lead re-run pending.
- M2 playable slice: server serves real engine (a280efe); protocol-level full matches 7–10 both modes pass (owner); game UI first screens on branch game-ui; scene package in dev; next: UI wired to real client + browser e2e full matches, voice gateway.
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
- Visual preview approval (+ 7 visual questions).
- Remaining rules: Q01, Q02, Q04, Q05, Q08, Q12, Q13, Q17, Q18, Q19, Q21, Q23; other phase durations; moderator powers beyond Yes count + listen (removal, act-for, set wolf target, speech, ballot visibility); reveal.historyAtEnd.
- Clarified by Human: disconnection gives no immunity from nomination/execution; eliminated offline → reconnect restores ghost state (Hunter pending mechanics apply), never resurrects. Regression tests: rules + foundation.
- Pending to Human: rules interpretations (no-Witch second step runs; nobody/player tie → player); balance (Q17/Q18) evidence sent.
- Hosting trust (server host can read secrets): (a) accept + (b) guide non-player host. [asked]
- First playtest network path; HTTPS options with verified costs incl. zero-cost (LAN voice-off = partial only, not voice acceptance). [asked; proposal later]

## Status 2026-10-17 (Lead)
- dev 36bdafd = intended deploy revision (foundation-9 full acceptance: check, matches x10 10/10, voice matches 10/10, strict UI 16/16, 0 misses/skips). Hosting: Railway Trial only selected (no paid/upgrade); Render documented alternative; deploy request pending; LiveKit Cloud probes/credentials unapproved.
- Merges since last log: voice 44fb793/a9b411d, rules-12 d3a3cbb (stalemate draw + match.end), visual-5 3400f92, game-ui 50dcc22, foundation-7 ca23197, foundation-8 5b081c4, foundation-9 36bdafd. Owner evidence in their reports; heavy-run conditions recorded.
- Open: voice candidate 1d12fc6 (publish-hang fix) fails measured-audio full matches (pages unresponsive); likely CPU starvation from scene rendering in many headless pages; under analysis, not merged.
- Heavy-run lock (serial, Lead hands out): voice → game-UI (b7bd170) → foundation-10 (strict UI skip-fail) → visual direction captures as needed.
- Human local preview: 127.0.0.1:4480 (real server, dev 44fb793) and :4481 (stub screens), game-UI owner's PIDs 77636/78025. Keep running.

## Decisions 2026-10-17 (Human)
- Hosting: Railway Trial only (no upgrade/paid/overage); Render documented alternative; durable volume recovery required; stop + report at credit/expiry. Deploy, main merge, LiveKit Cloud probes/credentials NOT approved.
- Playtest UX: D1 QR on host screen; D2 voice/mic only after explicit "Join voice" tap; D3 per-browser denied-mic guidance; D4 error only for full/started rooms (no spectator); D5 host may switch in-person/remote in lobby only; D6 moderator narration cues on by default, approved-consistent or neutral wording only (rules-13 statuses). D7 = pending Batch C1. D8 (Lead): rule errors as codes, after playtest.
- Heavy-run lock covers any browser automation that renders the scene (stub checks included); scene off otherwise. Acceptance runs use one scene observer at 4 fps reduced motion = test mitigation, not product performance evidence.
- Paseo installed source reference: /Users/long/repo/agent-workflow/paseo-v0.11.2/ (read-only).

## Deploy candidate (2026-10-17)
- **35151f2** (dev). Owner full acceptance on exact SHA (Lead read summary, all rc=0): check (rules 206, scene 28, voice 53, server 100, e2e 13); matches x10 10/10, voice matches x10 10/10 (token/channel, scene off, explicit join); strict UI 16/16 on new screens (laptop 7–10 both modes, Pixel 7 + iPhone 15 emulation 7 seats), 0 misses/skips, reload + network drop per match. Measured audio (voice owner, identical voice code, scene off): 2,917 pair-channel checks, 0 fails.
- Limitations: 4 fps single scene observer = test mitigation, not perf evidence; emulation only (no real devices/players/mics); LiveKit Cloud untested (local OSS); Railway facts verified only post-deploy (§7a); restarts interrupt; cost/bandwidth estimates; bot balance.
- Gates (0010 §9) sent to Human: Batch B; Batch C (moderated only); voice (Cloud probes+credentials) or explicit voice-off; deploy approval Railway Trial at 35151f2 (dev vs main?); hosting trust ack.
- Merges since 36bdafd: rules-13 2ea3952 (narration statuses), visual-7 24f4ae8 (scene quality/pause), game-ui 56dd4ed, visual-8 758c44a + visual-9 d3fa535 (labels), voice ce2dadc (join/leave, publish-hang fix, revoke-before-delete, CLOUD.md), foundation-10 8d6c7d9 (D2/D5, 1012 notice, lastCloseCode, scene knob, strict skip-fail), game-ui 84795d0 (D1–D6), foundation-11 35151f2 (gates §9, P18). Evidence in owners' reports/.cache/runs.
- Unmerged by design: visual-6 (mature scene redo), game-ui-art (UI restyle).

## Approved 2026-10-17 (Human "Ok" to deploy-trial-with-voice package)
- Deploy Railway Trial from dev at exact 35151f2 (service tracks branch `deploy-trial` pinned to 35151f2). No main merge, no paid upgrade/spend.
- Batch B as recommended (night 40+20; discussion 60+15/living clamped 90–240 s; nomination 30; defense 30; Yes/No 15; Hunter 20, ends on shot).
- Automatic-mode playtest first; Batch C pending.
- LiveKit Cloud probes < 100 free participant-minutes total; secrets entered by Human only in Railway dashboard (never chat/git/logs).
- Hosting trust accepted.
- Trial type (Full vs Limited) unknown: verify via outbound probe; if Limited, stop and report, never upgrade.
- Not deployed until a real URL + post-deploy evidence exist.
- Status: deploy-trial = 35151f2 (verified). Dashboard steps (0010 §7b, foundation-12) sent to Human via Supervisor. Post-deploy script dry-run passed locally (restart 1012 ~4.5 s, kill 1006 ~8.5 s, same seats). Voice Cloud check ready (~45 p-min, cap 60). Waiting for Human's dashboard steps + domain.
- Batch B made fixed in engine (rules-14 ad2429f, merged to dev); 35151f2 already runs identical defaults.
- Outside writes (rules, 2026-10-17): /tmp/moonveil-unused (created+deleted ~21:58), /tmp/.none (471 B, 22:01, left in place). No cleanup authorized.

## Decisions 2026-10-18 (Human)
- Direction: finish the game; deploy considered OK for now. Not acceptance of unverified Cloud audio / Railway persistence; no blanket future deploy/main merge.
- Rule change: during the 30 s defense ALL living players may speak publicly (accused keeps focus/timer; no PTT queue). Supersedes accused-only defense speech. Ghost/public separation, Hunter pending isolation, moderator powers unchanged.
- Settings UX: users find Settings confusing → game-UI audit + reversible clarity fixes within original style (personal vs room/host controls, plain labels, grouping, advanced collapsed).
- Live status: railway.app URL verified reachable/UI/idle 76 min/voice reach; persistence restart/redeploy untested live (retry script ready, on hold); www.moonveil.id.vn TLS ok but origin switch NOT applied (server 403s www origin); voice Cloud measured check running 00:17.

## Overnight plan 2026-10-18 (Human asleep; no deploy/main merge/Human actions)
- Lead self-check cron every 20 min (session-only job 1aa20ef6): read owners' latest reports, process candidates/lock, forward to Supervisor.
- dev 5480ccd (foundation-13: room event log, /api/status, rules-15 defense all-living speak, server tests). Live deploy remains 35151f2 (deploy-trial).
- Lock order: game-UI (settings clarity + opaque sheets + defense copy, heavy checks) → voice Cloud rotation-gap diagnosis (cap 15 p-min; aggregate ≈5.6/100 so far) → foundation release full acceptance on bundle SHA.
- Pending merges (light): foundation-14 (0010 §7b–7e notes + postdeploy script, from unmerged foundation-12) after UI window; voice small candidate (defense assertions + no-rotation-at-defense test); rules engine snapshot versioning (prevents restoring old in-progress matches under new rules).
- Unverified live: Railway restart/redeploy persistence; Cloud post-rotation audio gap (7 should-hear fails at old-rule defense window, cause unconfirmed); real devices. Cloud region nearest = Hyderabad (no Singapore).
- Proposals awaiting Human: 2 h room idle timeout; next deploy request (origin switch, revision move, persistence sequence) after release acceptance. Batches C/D/E unapproved.

## Overnight merges 2026-10-18 (owner root check on each exact SHA)
- 5480ccd foundation-13: event log, /api/status, rules-15 defense all-living speak, server tests (rules 209, server 106, e2e 13).
- 7254c31 rules-16: saved-match version + restoreCheck (rules 216).
- b890db9 game-ui: settings clarity, opaque sheets, create choice, regrouped lobby, defense copy (root + stub 101; heavy on 24ef99a: real-server 104, layout 170).
- 700698c foundation-14: deploy notes 7b–7e, postdeploy script, restoreCheck wiring (server 108).
- 1b4a836 voice: defense no-rotation test, Cloud check spec, rotation-gap spec, probe() (voice 54).
- Running: voice Cloud/local rotation-gap slot (cap 15 p-min). Next: foundation release full acceptance on bundle SHA.

## Release candidate (2026-10-18 overnight)
- **f12761a** = release candidate (supersedes acb9c82). Full acceptance 21:56–22:45Z all rc=0: check (rules 216, scene 28, voice 54, server 110, e2e 13); matches 10/10; voice matches 10/10; strict UI 16/16, 711/711, 0 misses (3 s click wait; 4 fps single observer). Adds voice connecting/reconnecting/unavailable+retry, voiceAvailable.
- (previous) **acb9c82** = release-bundle candidate. Full acceptance passed (owner run 18:11–19:00Z): check, matches 10/10, voice matches 10/10, strict UI 16/16 (0 misses), load 2.5–5.2.
- 3ceaeae (adds voice connecting/reconnecting UI) is in dev but NOT a candidate: two full runs each had 1 observer miss (a9-3, a8-6); 3/3 repro clean; suspected small regression from the new UI (under investigation by game-UI), vs test stall.
- Next release items: harness click wait 3 s + SeatView.voiceAvailable (foundation); voice-unavailable timeout/retry (game-ui-voice c078801).
- Cloud participant-minutes used ≈15.7 / 100.

## Morning handoff (sent to Supervisor 2026-10-18)
- Live 35151f2; candidate f12761a (accepted); dev a11737d (+ low scene profile for next release).
- Deploy request for f12761a: docs/architecture/0010 §7f (foundation-15 8a73d3d). Decisions asked: approve deploy + timing; 2 h idle timeout yes/no.

## (previous) LIVE 2026-10-18 08:58Z: 3b1dbde (deploy-trial = 3b1dbdeb43d9…)
- 2026-10-18 · deploy-trial · ff 671fd4f → 3b1dbde (08:57:46Z) · push-triggered Railway build; /api/status revision 3b1dbde (RAILWAY_GIT_COMMIT_SHA, Lead watcher 08:58:46Z + foundation), volume, voice configured; test lobby UHFAGM resumed (1012, ~16 s, same seats); both origins ok, foreign refused; fresh www room 84FN5J; look broadcast ok. Live rendered preview not checked live (scene off in harness; proven by UI two-seat check). Evidence foundation .cache/postdeploy/deploy4/. Other rooms untouched; Human did not confirm no active games.
- Auto-deploy: ON for this deploy; Human asked to turn OFF (pending confirmation). Optional restoredRooms/skippedRooms (expect ≥1 / 0).

## (previous) LIVE 2026-10-18 07:13Z: 671fd4f (deploy-trial = 671fd4ff8ffb…)
- 2026-10-18 · deploy-trial · ff f12761a → 671fd4f (07:12:03Z) · push-triggered Railway build; /api/status revision 671fd4f (RAILWAY_GIT_COMMIT_SHA), volume, voice configured; test lobby 2HUQ5A resumed (1012, ~16 s, same seats); both origins ok, foreign refused; fresh www room ok; look broadcast ok (scene update proven by unit tests + captures). Evidence foundation .cache/postdeploy/deploy3/. Full acceptance on 671fd4f 05:37–06:25Z all rc=0, strict UI 16/16 711/711.
- Auto-deploy confirmed OFF by Human (2026-10-18, after 671fd4f deploy). Optional restoredRooms/skippedRooms not supplied.
- Candidate 3b1dbde (live scene-avatar look preview): full acceptance DONE 08:23:19Z all rc=0 (strict UI 16/16, 711/711). Offered for deploy 08:47Z; approved and deployed 08:57Z (see above). FF from 671fd4f verified; state version 2.
- Lead practice: for every long run, start a local background watcher (exits when summary DONE / status changes) so completion wakes Lead; don't rely on Peer notifications or the 30-min cron (missed 3b1dbde completion by 24 min).

## (previous) LIVE 2026-10-18 04:32Z: f12761a (deploy-trial = f12761aa730b…)
- Deployment CLOSED: Human disabled auto-deploy after DEPLOY OK. No further dashboard changes needed; post-release usage snapshot not yet supplied (last known $4.98 / 29 days, pre-release).
- Mobile two-deploy path: deploy 1 = 35151f2 + origin vars (www public, railway.app allowed), verified 04:29Z; deploy 2 = push-triggered build of f12761a (auto-deploy ON, to be turned OFF by Human).
- Proof: /api/status JSON revision f12761a (Railway SHA, MOONVEIL_REVISION unset), persist volume /data/rooms, voice configured. Lobby TKZ4FS survived version change (1012, ~16 s, same seats). Railway Restart test passed earlier (CYR2J8, 1012, ~5 s). Fresh room on www OK.
- No MOONVEIL_ROOM_IDLE_MS (30 min idle stays). No main merge, no spend. Credit at start: $4.98 / 29 days.
- Unverified: real devices/players; Cloud audio on new defense rule.

## Lead message queue (deliver at owner's next turn end)
- (cleared)
- (cleared)

## Approved rules (Human, 2026-10-16) — rules owner records in docs/rules/PROPOSAL.md
- Batch A (Q17/Q18): 7–15 players; 2 Wolves at 7–12, 3 at 13–15; one each Seer/Witch/Guard/Hunter, rest Villagers; host customization within valid limits.
- Execution: Yes*2 > living count (abstain/disconnected stay in denominator). Only the execution threshold.
- Q06 Hunter: any gameplay death (incl. execution, Hunter shot) → 20 s to shoot one living player; timeout no shot; shot + chains resolve before victory; pending → no ghost voice/text/history/new ghost knowledge; admin removal gives no shot.
- Q14: zero survivors after all chains → draw.
- Q20: no reveal on death; all roles at match end; Hunter revealed by shooting.
- Q24: ghosts keep legitimately learned info, gain no secrets/actions/wolf channel; public events + ghost talk allowed (subject to Hunter pending isolation).
- Q20 exception: Hunter revealed when shot turn opens, even on timeout (supersedes "by shooting"). Ordinary deaths reveal nothing.
- Q16 (part): moderator enters Yes count (int 0..living, authoritative living); engine applies threshold; no direct day-result.
- Q03 Witch: 1 heal + 1 poison/match, both same night OK; self-heal yes, self-poison no; sees victim only while heal unused.
- Q07 wolves: living wolves see each other's picks; plurality; ties random among tied top. (Moderator-set target, wolf-on-wolf: still provisional.)
- Q09/Q10 nomination: unique top vote-getter tried, no majority needed; Skip counted; tie at top (incl. Skip) or Skip top → no trial; 30 s defense; then Yes/No.
- Q11 night: fixed 60 s total regardless of roles/early completion (internal split not separately approved; both steps always full length).
- Q22 votes (SUPERSEDED twice, final 2026-10-16): day nomination + Yes/No are OPEN ballots shown live (voter → target/Skip, voter → Yes/No) to every view incl. reconnect; changes accurate; counts derivable; no tally-secrecy claims. Fixed deadlines, no early close. Night actions/wolf channel unchanged and private.
- UI: language follows browser vi/en, switchable, remembered; in-person rooms voice off, wolves private text at night; no-action night roles get a plain waiting panel (no suspect notes in v1).
- Disconnect clarification: no immunity from nomination/execution/night kills; reconnect restores ghost state, never resurrects; offline Hunter keeps pending turn.
- Q25 channels (voice+text): day public (living); night living wolves only; defense only accused speaks; ghosts own channel + hear public (Hunter pending isolated); moderator listen-only all channels. No membership/participant/speaking leaks.
- Q15/Q26 disconnect: submitted choices persist; missing → pass at deadline; disconnected stay alive and in denominator; reconnect restores same state; automatic mode pauses timers while ALL player seats disconnected (moderator/spectator don't block), remaining durations preserved. Removal powers pending.

## Risks / notes
- Some web doc fetches are being rejected by the permission system; Peers source claims locally and label provenance; don't retry denied calls.
- Outside writes by foundation (2026-10-16): ~/.npm/_npx/e41f203b7505f1fb (rewritten), ~/.npm/_cacache (8 files), 3 ~/.npm/_logs files (07_05_07, 07_09_58, 07_10_05), /tmp/.mv_marker_never_used (created+deleted), WebKit: ~/Library/{Preferences/org.webkit.Playwright.plist, WebKit/org.webkit.Playwright/, Caches/org.webkit.Playwright/}, Not undone. (nsservicescache.plist attribution withdrawn: system rewrites it independently, observed 14:44:52/14:44:58 with no browser running.)
- Outside write by rules: /tmp/x (created+deleted 14:31). ~/.npm/_logs 07_05_55 + ~/.npm/_npx playwright 1.64.1 + _cacache = voice. 07_05_15 (npm ls --global) = visual (before boundary reminder).
- Outside writes by voice (besides brew): Homebrew bottle in ~/Library/Caches/Homebrew; /tmp/voice-results.txt; probable Go telemetry in ~/Library/Application Support/go/telemetry; Playwright temp profiles in OS temp (normally auto-removed). Not undone.
- Outside writes 15:07+ (2026-10-16): ~/Library/Preferences/com.google.chrome.for.testing.plist created 15:07:14 (key points at voice worktree's Chrome for Testing → likely voice; confirming). ~/Library/Application Support/Google/Chrome for Testing/Crashpad/settings.dat (pre-existing) probably rewritten by visual full-Chrome runs 14:25–14:59 (+ others; mtime 15:13:30). /tmp/dbg.ts (empty) by visual 15:07:17. Not undone. Full Chrome only if writes provably repo-local; WebKit (grant b) used for GPU captures.
- Crashpad settings.dat also modified 15:38:24; not claimed by visual/game-ui; foreign puppeteer chrome (~/.cache/hyperframes, another project) seen on machine. Attribution open.
- Brew autoremove removed libnghttp3 1.18.0 + libngtcp2 1.25.0 (beyond grant a). Read-only: no dependents, likely orphaned curl deps; reinstall gives same versions but marked on-request. Human (2026-10-16): leave removed, do not reinstall. Accepts resulting state; NOT retroactive authorization of the extra removal. Non-Homebrew consumers not ruled out. No further system cleanup or Homebrew operations authorized. Voice Peer records disposition in INSTALL_INCIDENT.md.
- Foundation `pkill -f apps/server/src/main.ts` ~15:20:50 may have hit other worktrees' servers; now exact PIDs only.
- Lead: aborted verification worktree (npm ci inside repo) removed; no outside writes known.
- Outside write by Lead: /tmp/null (331 B, npm ci output) 14:31, command mistake. Not undone.
- Foundation repo scripts now pin caches/tmp/browsers to .cache/ (verified: no new ~/.npm logs on check run).
- Open from foundation: ghost knowledge wording ambiguous (→ rules); fixed-length secret phases = pace vs timing-secrecy (→ rules); rooms in memory (restart loses); no mode/moderator change after creation.
- FIXED in a905925 (was open): silent network (no close) never reconnects until the link returns; client watchdog calls `ws.close()` and waits for an `onclose` that a dead link doesn't deliver (observed: client "open" 36 s+, server drops seat ~26 s). Fix next on `foundation-2`, with its own checks.
- INCIDENT: Voice Peer installed livekit-server system-wide via Homebrew. Outside existing authorization (WORKSPACE_PROTOCOL already limited writes to Moonveil). Pending: Peer's exact report (command/time, packages, running services, rollback + shared-machine impact) in docs/voice/INSTALL_INCIDENT.md. Rollback now authorized by grant a (voice owner, after narrow check); nothing beyond it. Tools stay inside Moonveil.

## Merge log
Grant c merges into `dev`, newest last. Format: date · branch · ff from → head · checks on exact SHA.
- 2026-10-16 · foundation · ff 0d17f46 → head = the commit adding this entry (parent 0f6a0d6; this commit only adds this log). Reviewed by Human/Lead: 09b33e2 scope + ownership. Checks (foundation owner, clean `node_modules`): `node scripts/env.mjs npm ci` ok; `npm run e2e:install` ok; `npm run check` exit 0 = typecheck clean (4 workspaces), server 10/10, e2e 8/8 (desktop-chromium 6, mobile-chromium Pixel 7 1, mobile-webkit iPhone 15 1 = WebKit/browser emulation). Run on 0f6a0d6 14:48–14:49 and re-run on head before ff. Known open bug: silent-network reconnect (see Risks).

- 2026-10-16 · visual · ff 064fbdf → 3225999 · Lead reviewed scope (preview/, docs/visual, additions only). Owner: typecheck on 3225999; captures regenerated from identical source (Chromium GPU headless + WebKit emulation).

- 2026-10-16 · rules · ff c857e21 → 9fceeb3 · Lead reviewed scope (packages/rules, docs/rules, lockfile delta own pkg). Owner root check on 9fceeb3: rules 152/152, server 10/10, e2e 8/8 (incl. WebKit emu).
- 2026-10-16 · foundation-2 · ff 9fceeb3 → a905925 · Lead reviewed scope (root tooling, apps/server, apps/web/src/client.ts, e2e, docs/architecture). Owner check: rules 152/152, server 20/20, e2e 13/13 (Pixel 7 + iPhone 15 WebKit emulation). Silent-network reconnect bug fixed.

- 2026-10-16 · rules-5 · ff 1e4a300 → 013206a · scope packages/rules, docs/rules. Owner root check: rules 183/183, server 20/20, e2e 13/13. Known flake (Q20 vs foundation assertion) fixed in foundation-3.
- 2026-10-16 · foundation-3 · ff 013206a → 3663e63 · scope apps/server, packages/protocol, e2e, docs/architecture, lockfile 1 line. Owner: rules 183/183, server 49 + 1 todo (moderator speech), e2e 13/13.
- 2026-10-16 · visual-2 · ff 3663e63 → a280efe · scope packages/scene, preview/ removed, docs/visual, workspace line + lockfile additions. Owner: rules 183/183, scene 12/12, server 49, e2e 13/13.

- 2026-10-16 · rules-6 · → 8cc710d · moderator listen-only default; strict config. Owner: rules 185/185, server 49+1 todo, e2e 13.
- 2026-10-16 · visual-3 · → c7fccf3 · mount seam/poses docs, scene 17/17. Owner root check exit 0 (E2E_PORT 4250).
- 2026-10-16 · game-ui · → e181de0 · first screens (owner report pending in this log).
- 2026-10-16 · rules-7 · → 69b0c76 · offline tests + participation-only voted status (superseded by open ballots).
- 2026-10-16 · voice · → 30a95ea · candidate reviewed by Lead; owner on 30a95ea: plain 4/4 + 52/52, TLS 4/4 + 52/52, headless shell.
- 2026-10-18 · visual-costumes · ff 235358e → 7f387e5 · Lead go (grant c; recorded by owner as "Human"). Scope packages/scene (seam rig.ts, seed, placeholder, tests), docs/visual/costumes. Owner c4495920 on 7f387e5: scene check 51/51; root check exit 0 (E2E_PORT 4250): rules 216, scene 51, voice 54, server 110, harness 3, e2e 13/13. No scene captures. Placeholder reachable only via scene dev page. Next: foundation-appearance.
- 2026-10-18 · game-ui-chat · ff 177a1dc → 896ea7e · Lead go (grant c; recorded by owner as "Human"). Scope apps/web/src/ui/**, apps/web/src/game/** (select senderOf, stub scenarios), docs/ui (+ screens-chat captures). Chat overlay: sender name+avatar from one seat, phone row clear of the campfire, uniform night box. Owner b5491460 on 896ea7e: root check exit 0 (E2E_PORT 4450): rules 216, scene 51, voice 54, server 110, harness 3, e2e 13/13; chat-check 60/60 (scene on, 2 pages); real-check run 1 FAIL: 2 assertions in moderator room 2 ("reached a defense and a verdict", "match still running"), then 30 s timeout on end-match-open (script exited, own server on 4460 left running, stopped); unchanged re-run 108/108 PASS. Lead adjudicated: deal-dependent test flaw (random deal can end room 2 before a verdict), not a chat regression; fix (deterministic room 2, 3 consecutive passes) is the next game-UI item.
- 2026-10-18 · foundation-appearance · ff 8a2b2ef → ac67e22 · Lead go. Scope packages/protocol (appearance.ts: catalog transcribed from art CATALOG.md 3776e4d, CostumeAppearance, ProfileInput, normalizeCostume, upgradeLegacy, legacyLook; error code invalid-appearance), apps/server (appearance.ts, room/rooms wiring, tolerant restore; tests incl. real 3b1dbde lobby/mid-match snapshot fixtures), docs/architecture/0011. Plus four UI call sites, type adaptation only (stub/local-room.ts profile, look-draft.ts sameLook params, components/index.tsx hat glyph index, Lobby.tsx edit-profile initial): a one-off handover from game UI decided by Lead, not a Human decision. STATE_VERSION unchanged (2); room snapshots v1 with legacy upgrade. Owner 46b279f0 on ac67e22: root check exit 0 (OS-assigned e2e ports): rules 216, scene 51, voice 54, server 115, harness 3, e2e 13/13; e2e:matches x10 10/10, 0 skipped steps, every expected end path (legacy {color,hat} clients upgraded in all 10). Load 6.5-7.8 (art owner's WebKit capture alongside, accepted).
- 2026-10-18 · visual-adapter · ff 0bddd95 → 6406a16 · Lead go (grant c). Scope packages/scene (adapter sceneAppearance + WIRE_OUTFITS allowlist, catalog test vs protocol OUTFITS, costume alias removed), docs/visual. Owner c4495920 on 6406a16: scene check 61/61. Root check (E2E_PORT 4250) run 1 rc=1: unit suites passed, e2e 0/13, all at browser launch (fresh worktree had no Playwright browsers; environmental). Run 2, same SHA, identical builds linked: exit 0, rules 216, scene 61, voice 54, server 115, harness 3, e2e 13/13. No scene captures. Eight art looks (art-costumes 77cd386) pass catalog+costume tests in scratch (72/72).
- 2026-10-18 · game-ui-followups · ff ce58e3b → 4acf44d · Lead go (grant c). Scope apps/web/src/ui/** (real-check room 2, landscape top bar CSS, night idle panel, layout/stub checks, capture), docs/ui (FLOW, screens-followups). Room-2 fix f7bca99: real-check 3 consecutive runs 108/108 (11:33–11:38Z, load 5.7–7.9, no failures). 06c3df2: stub 148/148, layout 336/336 (+ mutation: fix removed → 42 top-bar failures incl. Settings clipped). d8559d6: real-check 108/108. Final 4acf44d (merge of dev ce58e3b), owner b5491460, first runs: root check exit 0 (E2E_PORT 4450): rules 216, scene 61, voice 54, server 115, harness 3, e2e 13/13; real-check 108/108.

- 2026-10-18 · art-costumes · ff 880b497 → 8678b22 · Lead go (grant c). Scope packages/scene/src/costumes/** + docs/visual/themes/preview-*. Owner on exact 8678b22ede9340b2dc02a49993769da57aa404b6: scene check typecheck + 73/73. Root check (E2E_PORT=4650) run 1 failed at typecheck: missing worktree dependencies; environmental, unit suites/e2e not reached. After repo-local npm ci and linking identical existing Playwright builds (no browser downloads), run 2 on the same SHA exited 0: rules 216, scene 73, voice 54, server 115, harness 3, e2e 13/13 (Chromium + WebKit/browser emulation). Remote dev verified at 8678b22 before this separate log-only commit.

- 2026-10-18 · art-themes · ff a8ae555 → bc46d41 · Lead go (grant c), docs-only. Reviewed candidate bc46d4100f451ffa7ca8fe442c776b6d8529c2ea: 13 files under docs/visual/themes/** only (catalog, concept sheet, phone-scale references, prompts/provenance, shark construction). Diff check passed; no tests run for docs-only changes. Remote dev verified at bc46d41 before this separate log-only commit.

- 2026-10-18 · art-themes · ff cda935d → 837b3f8 · Lead go (grant c), docs-only. Reviewed candidate 837b3f8ecc9dc9160429378e232abfdaad6daf03: docs/visual/themes/CATALOG.md only; Vietnamese display names for all seven outfits and nine variants, camper included. Diff check passed; no tests run for docs-only changes. Remote dev verified at 837b3f8 before this separate log-only commit.
- 2026-10-18 · visual-framing · ff 4a27f75 → d7e66b6 · Lead go (grant c). Scope packages/scene (framing.ts: small-slot focus framing during play, bottom-band contract, debugCamera), docs/visual (MOUNT.md, framing/ evidence). Owner c4495920 on d7e66b6: scene check 78/78; root check exit 0 (E2E_PORT 4250): rules 216, scene 78, voice 54, server 115, harness 3, e2e 13/13. Captures (emulation, lock held then released): 375x667 labels 4.8→12 px, 390x844 9.6→12 px, laptops identical, no seat over chat row/top bar.
- 2026-10-18 · game-ui-picker · ff 68c5ef6 → 7628996 · Lead go (grant c). Scope apps/web/src/** (LookPicker, game/look.ts, entry + lobby editor, sceneAppearance preview, stub validation, checks) + docs/ui (FLOW, SELECTORS, screens-picker). One-off handover from foundation via Lead: apps/web/src/client.ts Profile → ProfileInput, type-only, 5 sites (932e1cb). Names: outfit/style from approved CATALOG.md (vi incl.). Owner b5491460, final set on c1ba380 (merge of dev 68c5ef6), first runs, all rc=0: stub 160/160 (12:48:52–12:49:37Z); picker-check 20/20 (12:49:37–12:49:44Z); chat-check 60/60 (12:49:44–12:53:58Z; phone scales 0.650/0.548/0.364 with the new framing, seats clear); root check E2E_PORT 4450 (12:53:58–12:57:04Z): rules 216, scene 78, voice 54, server 115, harness 3, e2e 13/13; real-check 108/108 (12:57:04–12:58:24Z); picker-check CAPTURE=1 22/22 (12:58:24–12:59:51Z). 7628996 = c1ba380 + 2 re-taken PNGs. Earlier on 5a9dea1: layout 350/350; 3 CAPTURE runs discarded as unusable captures (all assertions passed).
- 2026-10-18 · visual-labels-fire · ff 3909950 → 3497739 · Lead go (grant c). Scope packages/scene (name labels + leaders in own layer above all effects, STAGE_ORDER test, debugLabels, fixtures keep ghosts into night), docs/visual/labels-fire. Owner c4495920 on 3497739: scene check 79/79; root check exit 0 (E2E_PORT 4250): rules 216, scene 79, voice 54, server 115, harness 3, e2e 13/13. Before/after captures (emulation; lock released after): front-seat label over fire day + night, assertion passed in all 8 after runs.
- 2026-10-18 · game-ui-errors · ff c1667aa → 40bc0af · Lead go (grant c). Scope apps/web/src/ui/{errors.ts,GameApp.tsx,screens/Lobby.tsx,screens/Entry.tsx}, apps/web/src/game/look-draft.ts, dev checks, docs/ui/FLOW.md. Errors scoped to their screen (lobby refusal no longer in the match dock); look Save fails only on an error newer than Save. Owner b5491460. da35742: stub 163/164 FAIL (11j "rejected Save shows the notice": error snapshot taken after a synchronous refusal), picker-check 21/21; fixed in 4755b78 (error recorded before send): stub 164/164, picker-check 21/21. Final 40bc0af (merge of dev c1667aa), first runs, all rc=0: stub 164/164 (13:30:33–13:31:26Z); picker-check 21/21 (13:31:26–13:31:33Z); root check E2E_PORT 4450 (13:31:33–13:34:40Z): rules 216, scene 79, voice 54, server 115, harness 3, e2e 13/13; real-check 108/108 (13:34:40–13:36:00Z).
- 2026-10-18 · game-ui-leave · ff 8e1feb3 → ce31bac · Lead go (grant c). Scope apps/web/src/game/{session.ts,client-session.ts,stub/local-room.ts}, apps/web/src/ui/screens/{Panels.tsx,Entry.tsx}, i18n, dev checks (check.mjs 11n, leave-check.mjs new), docs/ui. Players' bug: Leave → dead-end overlay with /r/CODE kept. Fix (UI only, no server/protocol change): voluntary leave remembered by the session → entry at '/' (replaceState) with a note; involuntary end keeps the overlay ("no longer in this room" + Back to start); reconnect untouched. Owner b5491460, final ce31bac, first runs, all rc=0: stub 167/167 (14:04:14–14:04:58Z); leave-check 17/17 real server (14:04:58–14:05:09Z: home URL, create/join usable, refresh + Back no rejoin, reload + network drop same seat, others unaffected, host/moderator leave); root check E2E_PORT 4450 (14:05:09–14:08:15Z): rules 216, scene 79, voice 54, server 115, harness 3, e2e 13/13; real-check 108/108 (14:08:15–14:09:35Z).

## Acceptance evidence
- foundation b3d9ece: Lead re-ran `node scripts/env.mjs npm run check` 14:31 → typecheck ok, server 10/10, e2e 7/7 (8-browser auto isolation, 7+mod isolation, lobby, reconnect, 2nd tab, Pixel 7 emu). Chromium only. No new ~/.npm logs. Superseded by the merged revision (see Merge log).
