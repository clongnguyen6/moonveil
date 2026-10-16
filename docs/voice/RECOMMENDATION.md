# Moonveil voice: recommendation

Owner: voice peer (87bbae25). Status: proof done locally, provider recommended, no deployment. Short notes for agents.

Evidence tags used below: **[test]** proven by `spikes/voice` automated run · **[src]** read in locally installed package source/docs (`livekit-server` v1.13.10 source, `livekit-client` 2.22.4, `livekit-server-sdk` 2.19.1 type definitions) · **[web]** primary web page fetched today · **[unverified]** not checked.

## Decision

Use **LiveKit (self-hosted, Apache-2.0)** as the SFU, with **one LiveKit room per channel** and the Moonveil server as the only token issuer. Channel membership is decided by the game server; LiveKit never learns roles.

Why this shape and not "one room, server-controlled subscriptions":
- In one room, every participant list, track publish/unpublish and mute event is visible to all members **[src: `pkg/rtc/room.go` broadcasts ParticipantInfo to non-hidden participants]**. A wolf's mic going live at night would be visible metadata.
- Per-track subscription restrictions in LiveKit are set by the *publisher's client* (`setTrackSubscriptionPermissions`) **[src: `LocalParticipant.d.ts`]**, so they are client-side and do not meet the constraint.
- With separate rooms, non-members receive **nothing** about the room: no participant, no track, no speaker event. The only server-side primitives needed are token grants (`room`, `canPublish`, `canSubscribe`, `hidden`), `UpdateParticipant` (permission flips) and `DeleteRoom` **[src: `grants.d.ts`, `RoomServiceClient.d.ts`; test]**.

## Channel model (verified by test)

| Phase / state | public room | wolves room | ghosts room |
|---|---|---|---|
| lobby | all: publish+subscribe | – | – |
| day, living | publish+subscribe | wolves only: subscribe only (connected, silent) | – |
| night, living | subscribe only (uniform for all roles) | wolves only: publish+subscribe | – |
| ghost (any phase) | `hidden`, subscribe only | never | publish+subscribe |
| in-person mode | no tokens at all | no tokens | no tokens |

- Wolves are connected to the wolves room for the whole match, so no connection event marks nightfall; only their `canPublish` flips, and only they can observe it.
- Day→night flips `canPublish=false` for *everyone* in public via `UpdateParticipant`; the server removes the mic tracks itself **[src: `participant.go SetPermission` → `removePublishedTrack`]**. Calls run in parallel in shuffled order; a villager observed identical event signatures for wolves and villagers within one burst **[test]**.
- `hidden` participants are never included in participant lists or updates sent to others **[src: `room.go` lines ~1559, ~2365; test]**. Speaker updates are only sent for publishers a participant is subscribed to **[src: `room.go onSubscribeStatusChanged`]**.
- Text and emotes are not LiveKit's job: they go through Moonveil's own protocol with the same entitlement function. LiveKit data channels were disabled for non-publishers (`canPublishData` follows `canPublish`).

## Finding that changed the design: OSS LiveKit does not revoke issued tokens

`RemoveParticipant` accepts `revokeTokenTs`, but the open-source server ignores it (no revocation code in `pkg/service`; a dead wolf re-entered the wolves room with its cached token) **[src + test, run 1]**. Tokens are also auto-refreshed by the server every 5 minutes while connected **[src: `roommanager.go tokenRefreshInterval`]**.

Fix adopted and verified: **rotate a channel whenever anyone must leave it**. New room name (`<match>-<channel>-g<N>`), new tokens for members, `DeleteRoom` on the old one, `room.auto_create: false` so stale tokens for old names cannot join **[test: stale wolves token and stale living public token both rejected]**. Cost: the members of a rotated room reconnect once (about 1–2 s), which coincides with a death reveal. Day↔night flips do not rotate.

## Alternatives compared

| Option | Enforcement model | Fit for the channel rules | Cost | Verdict |
|---|---|---|---|---|
| **LiveKit self-hosted** | token grants + server API, rooms | all rules met **[test]** | $0 software; one small VM or the game server host **[unverified: VM price]** | **choose** |
| LiveKit Cloud | same API | same | Build plan $0/mo: 5,000 participant-minutes, 50 GB, 100 concurrent **[web: livekit.com/pricing]**. A 10-player, 60-min match = 600 min; ~8 matches/month fit the free tier. Ship $50/mo above that. Needs account sign-up (not done). | fallback if nobody wants to run a server |
| mediasoup (self-hosted library) | app code decides every Producer→Consumer; no built-in peers/permissions **[web: mediasoup.org design]** | achievable, but Moonveil would write the whole SFU signaling, room, reconnect and TURN story | $0 software, same hosting | more code, fewer features; only if LiveKit were rejected |
| Janus / Jitsi (JVB+Prosody+Jicofo) | Janus: plugin rooms, admin API; Jitsi: XMPP MUC rooms | multi-component, meeting-oriented; room-per-channel possible | $0 software; heavier ops (Jitsi: 3+ services) **[web, secondary sources only]** | not preferred |
| Galène (single Go binary) | groups with per-user `present`/`op`/`observe` **[web, galene.org]** | small and simple, but no documented server API for runtime permission flips; HTTP/JSON config | $0 | not preferred |
| Cloudflare Realtime SFU | HTTP API, app controls tracks pulled per session | plausible; 1,000 GB/month free then $0.05/GB **[web]** | account needed | fallback, untested |
| Agora / Daily (hosted) | server tokens, channels | plausible | Agora 10,000 min/month free then $0.99/1,000 audio min; Daily "10,000 free minutes/month" **[web]**, per-minute rate unverified | paid above small usage, vendor lock-in |
| P2P mesh (no SFU) | none server-side: each client decides what it sends | fails the constraint: a tampered client can route audio anywhere; 9 uplinks per phone at 10 players, battery and NAT issues; TURN still needed | $0 | reject |

## Cost paths

- **Zero cost, remote play:** LiveKit on the same host as the Moonveil server (one process, ~80 MB binary). Needs UDP reachability or TCP/TURN fallback (see hosting).
- **Zero cost, hosted:** LiveKit Cloud Build plan while usage stays under 5,000 participant-minutes/month **[web]**; requires an account (Human decision) and does not need the UDP/TURN work.
- **Zero cost, in-person:** voice off, text only. No LiveKit traffic at all **[test]**.
- Anything above: Ship $50/mo (LiveKit Cloud) or a ~$5–10/mo VPS **[unverified]**.

## Hosting implications (self-hosted)

- Ports: HTTP/WS signaling (behind TLS), ICE/TCP fallback port, and a UDP range **[src: `config-sample.yaml`: 7880, 7881, 50000–60000 defaults]**. Spike used 4300, 4301, UDP 4310–4350.
- Browsers require HTTPS for `getUserMedia` except on localhost, so production needs TLS termination in front of the signaling port.
- Players behind strict NAT need TURN. LiveKit embeds a TURN server (`turn:` block, TLS cert required) **[src: config-sample]**; or run coturn. Not tested here **[unverified]**.
- Single node, no Redis, is enough for one office group **[src: config-sample "when redis is set … distributed"]**.
- Capacity: 10 players ≈ 10 publishers at ~32 kbps Opus and ≤90 forwarded streams; trivial for one core. Tested with 10 browsers on one laptop; >10 not tested **[unverified]**.
- Use `room.auto_create: false` and create rooms from the server (needed for the rotation guard).

## Server responsibilities (for Foundation's seam)

1. Own the entitlement function `entitlements(player, gameState) → [{channel, canPublish, canSubscribe, hidden}]` (see `spikes/voice/server.mjs`). Same function gates text/emotes.
2. Hold the LiveKit API key/secret; mint tokens per (player, channel) with `room`, `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`, `hidden`, short TTL (spike: 15 min; 5 min is fine given server refresh).
3. On every state transition: reconcile LiveKit rooms *before* notifying clients: `UpdateParticipant` for permission flips (parallel, shuffled), channel rotation (`DeleteRoom` + new name) whenever a member must leave, then push new entitlements to each client over the game socket.
4. Create rooms explicitly; keep `auto_create` off.
5. Reconnect: re-issue tokens for the player's current entitlements under the same identity; LiveKit replaces the older connection of the same identity **[test: reload]**.
6. In-person mode: issue no voice tokens; expose the flag so clients show "voice off" and keep text.
7. Mic denied/failed: nothing changes server-side; the player holds a subscribe-only connection and plays by text **[test: p10]**. Client must call `room.startAudio()` from a tap when `canPlaybackAudio` is false **[src: livekit-client README]**.
8. Optional hardening: LiveKit webhooks (`participant_joined`) → kick anyone not entitled; log every token issued.

## Mobile constraints (documentation only, not tested on devices)

- Autoplay: Safari blocks audio with sound until a user gesture, granted per element **[web: webkit.org autoplay policy post]**; livekit-client reports `AudioPlaybackStatusChanged` and needs `startAudio()` inside a tap handler **[src]**. Design: the "join campfire" tap doubles as the audio unlock.
- Mic permission: must be requested from a gesture, over HTTPS. Plan the "check microphone" lobby step accordingly (approved scope).
- Backgrounding: WebKit bug reports say iOS Safari mic capture stops when the page is not visible and may not recover without re-calling `getUserMedia` or reloading; Android Chrome reports mic/playback stopping shortly after the screen turns off **[web: bug trackers and mailing lists, secondary]**. Treat "player backgrounded the tab" as "player muted"; re-acquire the mic on `visibilitychange` and re-issue tokens on reconnect. Real-device behaviour **[unverified]**.

## What the test proves (spikes/voice)

Command: `cd spikes/voice && npm test` (starts LiveKit 1.13.10 + spike server if needed, 10 Chromium contexts, fake mic = 440 Hz tone, "hears" = inbound `totalAudioEnergy` grows over 2 s). Results, SHA and run log: see `docs/voice/TEST_RESULTS.md`.

Checked by test: every channel rule in the table above, no participant-list/track/speaker leak to a villager at night, uniform event signatures at day→night, forced publish rejected server-side (villager at night, ghost in public), forged token rejected, stale tokens rejected after rotation, ghost never gets a wolves token, reconnect keeps identity and entitlements, in-person mode leaves LiveKit rooms empty, mic-denied player still hears.

Checked against documentation/source only: hidden-participant semantics in server code, token refresh interval, port/TURN/Redis requirements, autoplay and gesture rules, hosted prices.

Unverified: real iOS/Android devices and backgrounding, NAT traversal/TURN, TLS deployment, >10 participants, network-level traffic analysis (a LAN observer could see that a wolf's uplink carries audio at night; mitigation would be constant-bitrate silence frames, not pursued), LiveKit Cloud `revokeTokenTs` behaviour.

## Premises that turned out wrong or need a decision

- "RemoveParticipant revokes access" does not hold on OSS LiveKit; rotation is required (above).
- No macOS release binary of livekit-server exists (Linux/Windows only); macOS dev machines build from source (Go ≥ 1.26, ~1 min) or use Docker. Linux deploy uses the release tarball.
- Docker was not running on this machine; the spike runs without it.
- LiveKit Cloud free tier is realistic for an office group but requires an account: Human decision if wanted.

## Tooling note

A Homebrew `livekit` 1.13.10 install was made outside the repo early in this task; see `docs/voice/INSTALL_INCIDENT.md` for the rollback. The spike does not use it.
