# 0002: HTTPS for phones: options (corrected 2026-10-16)

Hosting shapes (single vs split host, why serverless isn't import-and-play): see 0007.

Status: options for Human + voice owner. Paper only; nothing installed, no certs, no system changes.
Detailed per-option evidence: `docs/voice/SECURE_CONTEXT.md` (voice owner, tested parts tagged). This note adds foundation's view and corrects my first version.

**Correction:** my first version implied that in-game voice needs paid hosting. That's wrong. HTTPS is needed for the microphone on a LAN or remote, but several options cost $0. They differ in sign-ups, deployment and phone trust.
**Also corrected:** an in-person, voice-off LAN session over plain http only partly tests the game. It doesn't meet the in-game voice requirement and can't run the mic check.

## Requirements
- A secure context (https, localhost, 127/8) is needed for the microphone (`getUserMedia`), and also for clipboard write and screen wake lock (MDN). A LAN IP over http is not secure.
- On an https page every WebSocket must be `wss://`: both the game (`/ws`) and LiveKit signaling. OSS LiveKit has no TLS on signaling, so a TLS front (Caddy/nginx/Node proxy) is part of every self-hosted option (voice doc).
- **Foundation server behind a TLS front:**
  - forward WebSocket upgrades on `/ws`;
  - **preserve `Host`**, because the same-origin check compares `Origin` with `Host`. Caddy preserves it by default (unverified here); nginx needs `proxy_set_header Host $host`;
  - the client picks `wss` from `location.protocol` (already done).
- Remote players additionally need the SFU reachable (UDP range or TCP/TURN). An HTTP tunnel does not carry WebRTC media.

## Options

| | Option | Money | Sign-up | Deployment | Phones need | LAN voice | Remote voice | Verified |
|---|---|---|---|---|---|---|---|---|
| A | Private CA + leaf cert (Caddy `tls internal` / mkcert-style) | $0 | none | none | **install and fully trust a CA** (iOS: Settings › General › About › Certificate Trust Settings; Android: install CA cert) | yes | yes, if the SFU is reachable (NAT/TURN work) | in-repo by SPKI pin, not by a real CA install (voice test). CA install = **unapproved** (grant d). CA key can intercept a phone's TLS if leaked |
| B | Free DNS name (e.g. DuckDNS) + Let's Encrypt DNS-01 + A record → LAN IP | $0 (own domain ~$10/yr optional, unverified) | DNS host account (DuckDNS: Google/GitHub login) | none (laptop runs the TLS front) | nothing | yes | yes, if the SFU is reachable | DNS-01 works without public reachability (LE docs). Router DNS-rebind blocking of private-IP answers: unverified per network |
| C | Tailscale + `tailscale cert` (ts.net) | $0 up to 6 users (Tailscale pricing); 7–10 players exceed it (unverified how) | every player | none | install Tailscale and join the tailnet | yes | yes (mesh removes NAT work) | machine names go to public CT logs (Tailscale docs) |
| D | Quick tunnel (Cloudflare TryCloudflare) | $0 | none | public URL = deployment-like (needs approval) | nothing | page/signaling only; media still needs a path | no (no UDP/WebRTC) | WebSocket support not stated in the doc; third party terminates TLS and sees game payloads |
| E1 | LiveKit Cloud Build plan for the SFU + game page via A or B | $0 under 5,000 participant-min/month (about 8 ten-player hours); Ship $50/mo above | LiveKit account | game server still local | as for A or B | yes | yes (hosted SFU, TLS, TURN) | pricing page (voice doc); grant d: sign-up unapproved |
| E2 | VPS/cloud with domain + Let's Encrypt (game + LiveKit) | ~$5–10/mo (unverified); free-tier VMs exist (terms unverified) | provider | yes | nothing | yes | yes | ops + Human approval for cost and deploy |
| F | Browser flags (Android Chrome insecure-origin flag; desktop SPKI pin) | $0 | none | none | per-device flag; **not possible on iOS** | test only | test only | used by the voice test |

## Foundation's view
- **Zero cost, zero device setup, in-game voice on LAN: B.** Needs one sign-up (DNS host) and one-time setup on the hosting laptop. That's the best first playtest setup if Human approves the sign-up.
- **Zero cost, no sign-up: A.** Costs a CA install on every phone (not approved at the time) and carries a real security caveat.
- **Remote voice for 7–10 players at $0:** B or A for the page, plus a reachable SFU. Either the laptop SFU behind NAT (TURN work, untested) or E1 (sign-up, free tier limits). Otherwise E2 (cost).
- **Plain-http LAN voice-off (old option "A"):** usable only as a partial play test. No mic check, no clipboard, no wake lock.

## Foundation work for any choice (small, not built)
- An optional TLS listener in the server (`HTTPS_CERT`/`HTTPS_KEY`), or documented proxy configs for Caddy and nginx (Host preserved, WS upgrade).
- LAN invite URL: the server exposes its LAN addresses so a host browsing on localhost can share a reachable link (built in foundation-4: `GET /api/lan`).
