# Moonveil workspace protocol

Approved through user interview, 2026-10-16. Product decisions live in `PROJECT_BRIEF.md`.

## Roles and ownership

- Human owns outcomes, priorities, scope, costs, and final acceptance. Human does not write code; plan for capable agents working continuously, not a human engineering team.
- Supervisor works outside the room: clarifies direction, hands over context, watches cross-project drift and contention, and brings decisions to Human. Supervisor does not implement or hold the room's working state. Reviews happen when Human asks.
- Lead holds shared room state, assigns ownership, resolves dependencies, coordinates integration, evaluates evidence, and answers for acceptance.
- Peers investigate, design, implement, and review. Implementation belongs to Peers, including small changes and integration fixes. Lead does not become an implementer because scope is small.
- Each changing scope has one owner until explicit handoff. Peers may inspect and challenge other scopes but must not edit them without an ownership change.
- Human and Supervisor may contact any agent. Direction changes must also reach Lead and the shared state.

## Autonomy and decisions

- Lead chooses technical approaches and coordinates execution within approved product scope without routine approval requests.
- Bring changes to gameplay, scope, visual direction, or unapproved costs to Human before proceeding with those changes.
- Present an early camping visual preview for Human approval before broad visual production. This does not replace final acceptance.
- If Human is unavailable, continue independent work and hold only work dependent on the pending decision. Silence is not approval.
- Approved user decisions are constraints. Proposed designs and open assumptions may be questioned with evidence; do not silently turn them into constraints.
- Do not expand scope or hide a broken assumption with a workaround. Report the finding, its effect, and the smallest useful decision.

## Workspace and references

- Write only within `/Users/long/repo/games/moonveil`. Changing another repository requires explicit Human authorization.
- Read `/Users/long/repo/games/sky2` to compare rules and implementation. Its behavior is reference evidence, not automatically the intended Moonveil rule.
- Read the supplied communication reference:
  `/Users/long/repo/obsidian/COG-second-brain/11-dexport/agent-reach/topics/giao-tiep-nguoi-choi-game-web/x/knowledge/giao-tiep-nguoi-choi-game-web.md`.
- Read `/Users/long/repo/agent-workflow` when needed for SLP/Paseo reference. Do not modify it or delegate modifications without explicit Human authorization.
- `/Users/long/repo/secret` is off limits without exception or later override: no entering, listing, reading, searching, writing, copying, sharing, metadata inspection, or indirect access through symlinks, parent traversal, scripts, or agents. Never run a broad command whose scope includes it. If needed for a task, stop that task and state that the folder is forbidden; do not request access.

## Git and deployment

- Agents may commit, push, and create PRs autonomously within Moonveil.
- Merge and deployment each require explicit Human approval, including deployment to a test environment. Local development and local verification may proceed.
- Make the proposed merge/deployment concrete and reviewable before requesting approval: relevant revision, evidence, remaining limitations, and any cost.
- Permission to push does not permit destructive history rewrites or data deletion outside explicitly authorized scope. Preserve unrelated work.

## Approved grants (2026-10-16)

Granted by Human. Exact scope; do not widen. Grant c is a standing approval under the merge rule above.

- **a. Cleanup.** Uninstalling Homebrew formula `livekit` and deleting `/tmp/null` is authorized, but only after a narrow check that the reported state still holds and nothing has started depending on them. Not included: `brew cleanup`, shared npm/npx caches, npm logs, other system paths. Shared caches stay. The voice owner performs this. WebKit artifacts listed under grant b are kept (they are covered by that testing exception). Do not claim restoration of unrecoverable prior cache state.
- **b. WebKit testing.** Playwright may write only to `~/Library/Preferences/org.webkit.Playwright.plist`, `~/Library/WebKit/org.webkit.Playwright/` and `~/Library/Caches/org.webkit.Playwright/`. Every other cache stays repo-local. No general system-install, certificate or home-directory write permission. Results are labelled "WebKit/browser emulation", not real iPhone validation.
- **c. Standing dev integration.** Fast-forward-only merges of scope branches into `dev` are allowed, performed by the owner Peer after Lead reviews scope and ownership. The owner's meaningful checks must pass on the exact final SHA, after any rebase. Each merge and its evidence gets logged. No force-push or destructive rewrite of shared branches. Merges into `main` and every deployment still need separate explicit approval. Revocable.
- **d. Voice.** LiveKit OSS is selected for implementation and local verification only. Zero licence cost is not zero operating cost. Hosting, TURN, service costs, sign-ups, certificate installation and deployment remain unapproved.

## Evidence and acceptance

- Final delivery must include a complete playable first version and polished camping visuals, animation, transitions, audio, and UI. Functional completeness alone is insufficient.
- Agents verify complete matches using multiple browser sessions, role/channel isolation, reconnect behavior, and phone/laptop layouts. Test both moderator and automatic modes.
- Distinguish browser mobile emulation from real-device testing. Real-device testing is not a prerequisite selected by Human; do not claim it occurred without evidence.
- Human and colleagues assess play feel after agent verification. Do not report simulated sessions as real player playtesting.
- Reviewers identify the revision reviewed. Integration evidence must apply to the revision proposed for acceptance.
- Run checks appropriate to changed behavior. For failures, supply a reproducible case and verify the correction; do not treat passing component tests alone as proof of a working game.
- Lead reports remaining risks, incomplete checks, and unmet criteria honestly. Lead's readiness report does not replace Human acceptance.

## Room state and reporting

- Lead maintains concise shared records of current owners, decisions, dependencies, pending questions, and acceptance evidence. Choose a lightweight format inside Moonveil.
- Handoffs include outcome and why, verified constraints, open assumptions, decisions made, and decisions still open to challenge—not only a task list.
- Lead's upstream reports start with its agent ID and project name, Moonveil. Distinguish complete work, waiting for Peers, and a decision request.
- A Paseo finished notification only means a turn ended. Do not equate it with task completion or send acknowledgement-only messages to re-arm notifications.
- Report meaningful drift, blockers, decisions, and milestones; keep healthy routine brief. Coordinate shared-machine benchmarks before occupying resources needed by another room.
- Write short notes and comments for agents. Keep current decisions authoritative and record Human-approved changes.

## Lead creation

- Supervisor creates Lead only when Human requests it, using Moonveil's verified `workspaceId`.
- Seat: `claude-lead/claude-opus-5-5`; settings: `modeId: "bypassPermissions"`, `thinkingOptionId: "high"`. Do not look up providers/models.
- Include Supervisor's agent ID in the initial prompt, read from `PASEO_AGENT_ID`. If unavailable, omit it and tell Human; never guess.
- Preserve all role boundaries in the initial handoff. Creating these documents does not itself authorize starting a Lead.

