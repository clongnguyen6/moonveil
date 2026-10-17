# LiveKit Cloud compatibility for the voice gateway

Owner: voice. Paper analysis (2026-10-17) for the hosting direction "the app host (Railway first; Render alternative) for the game server + LiveKit Cloud (existing account) for voice". Nothing here was run against Cloud; see §5 for what would be. Hosting, sign-ups, Cloud credentials and deployment stay unapproved (grant d).

Evidence tags: **[docs 2026-10-17]** primary LiveKit docs fetched today (`docs.livekit.io`: quotas-and-limits, intro/basics/…/participants, frontends/reference/tokens-grants, deploy/admin/firewall, deploy/admin/regions) · **[src]** our code or installed SDK/server source · **[search]** secondary (forum, KB) · **[unverified]**.

## 1. Does `LiveKitVoiceGateway` work against Cloud with config only?

Yes, for the parts the gateway uses: `CreateRoom`, `ListParticipants`, `UpdateParticipant`, `DeleteRoom`, and tokens minted with `AccessToken` **[src: `packages/voice/src/server/backend.ts`, `tokens.ts`]**. Config: `LIVEKIT_URL=https://<project>.livekit.cloud` (the server SDK also accepts the `wss://` form and rewrites it to `https://` **[src: `livekit-server-sdk/dist/TwirpRPC.js`]**), `LIVEKIT_PUBLIC_WS=wss://<project>.livekit.cloud`, and the project's API key/secret; Foundation's `main.ts` already reads these four **[src]**. Browsers detect a `*.livekit.cloud` URL and pick the nearest region themselves (`RegionUrlProvider`) **[src: `livekit-client`]**.

Code changes made for Cloud (2026-10-17, `packages/voice`, unit-tested against `FakeBackend`; none were required to connect):
- **Revoke on departure (Cloud-only effect).** `VoiceBackend.removeParticipant(room, identity, revokeTokenTs)`; when a room generation closes (rotation or `closeRoom`), the gateway removes every participant present in it with `revokeTokenTs = now − 1 s` and only then calls `DeleteRoom`. Fresh tokens for the next generation are minted afterwards with `nbf = now`, so they are never "before" the cutoff, while every earlier token is. On OSS the field is ignored (verified in the server source) and behaviour is unchanged **[src: gateway tests "rotation: every participant…", "closeRoom revokes…"]**.
- **Code-based not-found.** `isNotFound()` now checks the SDK's `ServerError` fields (`code === 'not_found'` or HTTP `status === 404`) instead of message text, so Cloud's wording no longer matters **[src: `backend.test.ts`]**.
- Nothing else: room names, `emptyTimeout`, hidden grants and `canPublish` updates are the same API.

## 2. Token revocation and room rotation on Cloud

- **Cloud revokes tokens**: `RemoveParticipant` "also immediately revokes their access token"; a permission change via `UpdateParticipant` "also revokes the participant's current token, and a new one is issued automatically"; `revoke_token_ts` is "LiveKit Cloud only", must be within 60 s of server time, and when omitted the cutoff is "the current time with a one-minute buffer", so "a token issued within about a minute before removal can still rejoin until it expires" unless an explicit timestamp is passed **[docs 2026-10-17]**. Self-hosted: removal or permission updates "doesn't invalidate the participant's existing token" **[docs 2026-10-17]**, matching what the spike measured on OSS.
- **Is rotation still required?** Yes, for two reasons that revocation does not cover: (a) visibility flips (alive→ghost in public, defense listeners) cannot be applied in place, since LiveKit never tells other participants that a visible participant became hidden **[src: `room.go`]**; (b) uniform leave at a phase boundary is a property of closing the room, not of tokens. What revocation adds on Cloud is defence in depth against stale tokens, including the case `DeleteRoom` + auto-create (§3).
- **Is rotation safe on Cloud?** `DeleteRoom` and explicit `CreateRoom` are standard APIs; room names stay unique (`<code>-<channel>-g<N>`). Whether `DeleteRoom` itself revokes the tokens of the deleted room on Cloud is **[unverified]** (docs mention revocation for `RemoveParticipant` and `UpdateParticipant` only); hence the `RemoveParticipant`-before-`DeleteRoom` change above. Cost: each rotation is one reconnect per member; Cloud bills by connected time, so rotation adds seconds, not minutes.

## 3. Hidden participants, `canPublish` updates, auto-create

- **Hidden**: "A hidden participant is not visible to other participants in the room" (token grant `hidden`) **[docs 2026-10-17]**; same semantics as OSS **[src]**. Our ghost/pending-Hunter/moderator/defense-listener sessions rely on it unchanged.
- **`UpdateParticipant`**: needs `roomAdmin` (our server API key has it); "revoking CanPublish automatically unpublishes all tracks" and clients get `ParticipantPermissionChanged` **[docs 2026-10-17]**, as measured on OSS. On Cloud it also rotates the participant's token automatically; our `sync` re-mints sessions on permission change anyway, so clients always hold a valid one.
- **Auto-create**: OSS `room.auto_create: false` is what makes a stale token for a deleted room name fail. On Cloud, a project-settings toggle for automatic room creation is reported in a community thread **[search, unverified]**; official docs describe join-creates-room as the default. If it cannot be disabled, a stale *unrevoked* token for an old room name would recreate an empty room (nobody else can be there: current members hold tokens for the new generation), i.e. a billing/cleanliness issue, not a secrecy leak. With `RemoveParticipant`+`revokeTokenTs` (§1) the token is dead first. Verify the toggle in the Cloud dashboard (§5).

## 4. Connectivity, region, quota

- **TURN/TLS**: Cloud clients need outbound `*.livekit.cloud` TCP 443 (signaling), `*.turn.livekit.cloud` TCP 443 (TURN/TLS when UDP is blocked), `*.host.livekit.cloud` UDP 3478 (TURN/UDP), and ideally UDP 50000–60000 / TCP 7881 for direct media **[docs 2026-10-17, firewall page; regional host list updated 2026-07-21]**. LiveKit operates these TURN hosts; the client SDK falls back to them automatically after direct UDP/TCP fail **[docs 2026-10-17]**. Nothing to deploy on our side, unlike self-hosting (ADR 0002).
- **Region near Vietnam**: Cloud routes "to the nearest server" by default; region pinning and regional endpoints exist **[docs 2026-10-17]**. The firewall page's regional hostnames include `otokyo1a` and `osydney1a`; a Singapore zone is **[unverified]** (the page lists ~50 zones; I did not fetch the full list). Expected media RTT from Vietnam to Tokyo or Singapore: tens of ms **[unverified, measure in §5]**.
- **Free tier (Build)**: 5,000 participant-minutes/month, 50 GB downstream, 100 concurrent connected participants across rooms; a **hard cap**: "new requests fail rather than incurring overage"; allowances reset on the 1st; shared across all free projects of the account **[docs 2026-10-17]**. Whether already-connected participants are cut at the cap: docs say new operations fail; one forum report says rooms were terminated **[search, unverified]**. Our client would show the channel as `failed` on a rejected connect and keep text working; no code change needed for that path, but the UI should explain "voice unavailable".
- **Does each room session count separately?** Minutes are "time that a single user is connected to LiveKit Cloud via a LiveKit SDK" **[docs 2026-10-17]**; whether two simultaneous room connections of one browser count twice is **[unverified]**, assume yes. Budget per 10-player, 60-minute match, counting every room connection: living seats ≈ 1 connection each by day and night (wolves: wolves room only at night), ghosts 2 (public + ghosts), moderator 3 → roughly 650–800 participant-minutes; about 6 matches per month on the free tier, and the 100-concurrent limit is far (≈ 25 peak). Rotations add seconds only.

## 4a. Deployment approved (2026-10-17): config names, failure detection, probe budget

Approved: Railway Trial at exactly 35151f2 + LiveKit Cloud; probes ≤ 100 participant-minutes in total; the key/secret are entered only in the app host's dashboard by the account holder, never locally, so all Cloud evidence comes from the deployed service.

**Exact env names and formats** (the server reads all four or none; a partial set is a startup error **[src: `apps/server/src/main.ts`]**):
- `LIVEKIT_URL=https://<project>.livekit.cloud` — API base for the server (RoomService). The `wss://` form is also accepted (the SDK rewrites `ws`→`http`), but use `https://` for clarity.
- `LIVEKIT_PUBLIC_WS=wss://<project>.livekit.cloud` — what browsers connect to; the client resolves the nearest regional host itself.
- `LIVEKIT_API_KEY=API…` and `LIVEKIT_API_SECRET=…` — the project key pair from the Cloud dashboard.
`<project>` is the project subdomain shown in the Cloud dashboard (typically `<name>-<id>`), the same host for both URLs.

**What the server logs if the outbound path to LiveKit's API fails** (detects a limited trial / egress block / wrong key): nothing at startup today; the first lobby flush triggers `sync` → `voice sync <ROOMCODE>: <error>` (from `Room.syncVoice`) or `voice <ROOMCODE>: <error>` (gateway `onError`), with the socket error (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`, `EAI_AGAIN`) or an HTTP status/twirp code (`401 unauthenticated` = bad key/secret; `403`). Clients then receive no `voice` message and the UI shows voice unavailable while text continues. Added for a cleaner check: `LiveKitBackend.probe()` (one `ListRooms`), which foundation can call at startup and expose in `/healthz` as `voice: ok|<error>`; until wired, a manual check is to create a lobby and watch the server log for the lines above.

**Runtime check and budget:** `packages/voice/e2e/cloud-check.spec.ts` (`npm run e2e:cloud`, see README). Smallest real match is 7 players (Batch A minimum) + moderator = 8 pages. Estimate: ~1.1 connected channels per page on average over ~5 min of play ≈ 45 participant-minutes; the guard samples connected channels every 5 s, prints the running total after each step, and leaves voice before `VOICE_CLOUD_CAP_MIN` (default 60) so one run stays well under the 100-minute approval. Region is read from Cloud's `/settings/regions` with a session token held in memory (names only are printed). Revocation is checked without media through `/rtc/validate`: the executed seat's old public token must be rejected after the rotation while a fresh token validates. TURN fallback is not included: forcing relay needs a separate browser launch with a WebRTC IP-handling policy flag and a second seat budget; it can be added as an opt-in if the first run leaves budget.

## 5. Cloud runtime test plan (nothing run yet)

What local OSS already proves (and Cloud shares the code path for): grant→permission mapping, hidden sessions, `UpdateParticipant` publish flips, rotation mechanics, token shape, client reconnect, the full-match hear-matrix. What only a real Cloud project can show: revocation timing, `DeleteRoom` vs tokens, the auto-create toggle, error wording, region/latency from Vietnam, TURN fallback, quota behaviour.

**Prerequisites (Human):** authorize the use of the existing Cloud account for a test, and provide a project API key/secret as a test key. The key lives only in a gitignored local env file (`.env.voice-cloud`, listed in `.gitignore`) or in the app host's environment settings (Railway first; Render alternative); never committed, logged or shown. Playwright traces are off for Cloud runs because wire capture would store tokens in `.cache` artifacts. Expected consumption: smoke ≈ 20 participant-minutes; full-match run ≈ 300; keep a 1,000-minute margin under the 5,000 cap.

**Suite changes (voice scope, before any run):** a `VOICE_E2E_TARGET=cloud` mode for `packages/voice/e2e`: skip starting local LiveKit, read `LIVEKIT_*` from env, disable traces and frame logging, and add the Cloud probes below as a separate spec that is skipped unless the target is `cloud`.

| # | Probe | Expected | Verifies |
|---|---|---|---|
| C1 | two browsers join one room, measure energy both ways | hear each other | config-only compatibility, region auto-selection; record `RegionUrlProvider` choice and RTT |
| C2 | rotation (public death case) as the gateway does it: `RemoveParticipant`+`revokeTokenTs = now − 1 s` for everyone present, then `DeleteRoom`; old token tried after 0 s, 30 s, 90 s; a fresh next-generation token tried at once | old token rejected at every point, fresh one accepted; no room recreated under the old name | revocation semantics incl. the one-minute buffer and the −1 s cutoff; `DeleteRoom` vs tokens |
| C3 | `DeleteRoom` only (no RemoveParticipant), old token tried | records whether it rejoins and whether an empty room appears | whether rotation alone is enough on Cloud; auto-create toggle state |
| C4 | `UpdateParticipant` canPublish false/true on a connected seat | tracks removed, event received, client still connected with a working token | permission flips + automatic token rotation |
| C5 | hidden listen-only session (moderator pattern) | not in rosters/speaker lists of others; `ListParticipants` shows hidden | hidden on Cloud |
| C6 | block UDP for one browser (Chromium `--force-fieldtrials`/network rules or a host firewall rule, local only) | connects via TURN/TLS 443 and hears | TURN fallback |
| C7 | read quota usage in the dashboard before/after C1–C6 | minutes consumed ≈ sum of connection times; note whether two rooms of one browser count twice | billing unit |
| C8 | not-found wording: `DeleteRoom`/`ListParticipants` on a missing room | error text recorded; `isNotFound()` adjusted if needed | §1 |

Cap behaviour (what clients see at 5,000 minutes) is **not** probed deliberately: it would burn the month's allowance. It stays **[unverified]** unless Human accepts that cost.

Reporting: results go into `TEST_RESULTS.md` with the date, project region and minutes consumed; no token or key ever appears in logs or docs.
