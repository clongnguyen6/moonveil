# Secure context for voice (HTTPS on a laptop-hosted server)

Problem (Foundation's finding, confirmed here **[test]**): browsers expose `navigator.mediaDevices` only in a secure context. `http://192.168.x.x:4100` on a phone is not one, so there is no microphone at all. Only `https://`, `localhost` and `127/8` count. This affects both the in-person and the home case whenever the server runs on someone's laptop.

Two things must be secure, not one:
1. the page origin (so `getUserMedia` exists), and
2. the LiveKit signaling WebSocket, which must be `wss://`, because an https page blocks `ws://` as mixed content. Media (DTLS-SRTP over UDP/TCP) needs no certificate.

Open-source LiveKit has **no TLS option on its signaling port**; its sample config says to put it behind a TLS terminator **[src: `config-sample.yaml` line 16; `config.go` has TLS fields only for the HTTP/3 and TURN listeners]**. So a reverse proxy is part of the self-hosted design in every option below. The spike's `tls-proxy.mjs` (Node, 40 lines) stands in for Caddy/nginx: one https origin, `/rtc` and `/twirp` to LiveKit, everything else to the game server, with the game server answering `wss://<same host>` for LiveKit when it sees `x-forwarded-proto: https` **[test]**.

Evidence tags: **[test]** in-repo Playwright run · **[src]** local package source · **[web]** primary web page fetched today · **[unverified]**.

## Options

| # | Option | What the host needs | What each phone needs | Works for | Cost | Notes |
|---|---|---|---|---|---|---|
| A | Own private CA + leaf cert (openssl, mkcert-style, or Caddy `tls internal`) | generate CA once, leaf with SAN = LAN IP and/or `host.local`; reissue when the IP changes; run proxy | **install the CA**: iOS: open the `.crt`, install profile, then Settings › General › About › Certificate Trust Settings › enable full trust **[web: Apple support 102390]**. Android: Settings › Security › Encryption & credentials › Install a certificate › CA certificate; Chrome trusts user CAs; Android shows a permanent "network may be monitored" notice **[web: Samsung Knox KB, LWN]** | in-person and home (home also needs NAT/TURN) | $0 | Zero accounts. Real security cost: a trusted root on a colleague's phone can intercept all their TLS traffic if the key leaks. Mitigate with a short-lived CA kept offline, or a name-constrained CA (iOS/Android honouring name constraints: **[unverified]**). Proven in-repo by SPKI pin, not by CA install **[test]**. |
| B | Public cert for a real name pointing at the LAN IP (Let's Encrypt, DNS-01) | a DNS name you control; A record → 192.168.x.x (public DNS or router split-horizon); DHCP reservation for the laptop; renew ≤ 90 days via DNS API; run proxy | nothing | in-person and home | $0 with a free DNS host such as DuckDNS (TXT API exists, login via Google/GitHub etc.) **[web: duckdns.org/spec]**; otherwise domain fee (~$10/yr **[unverified]**) | Best phone experience. Needs an account at the DNS host (Human decision). Some home routers block public DNS answers with private IPs (DNS rebind protection) **[web: forum reports, unverified]**. Let's Encrypt cannot issue for private IPs directly **[web: LE community]**. |
| C | Tailscale: `tailscale cert` + MagicDNS name `host.tailnet.ts.net` | Tailscale on the laptop, `tailscale cert`, proxy | install Tailscale app, join the tailnet (account) | home and in-person; also removes NAT/TURN work because everyone is on one WireGuard mesh | Personal plan $0, up to 6 users **[web: tailscale.com/pricing]**; 7–10 players exceed it → paid or shared logins **[unverified]** | Machine names end up in public CT logs **[web: Tailscale docs]**. Heavy ask for casual colleagues. |
| D | Public tunnel for signaling (Cloudflare Tunnel, ngrok…) | tunnel client, account | nothing | in-person only: media still flows over the LAN via host ICE candidates **[unverified]**; home play needs the SFU reachable → not solved | free tiers exist **[unverified]** | Signaling leaves the LAN; odd for an office game. Not recommended. |
| E | Host it: VPS or cloud with a domain + Let's Encrypt (or LiveKit Cloud for the SFU + hosted game server) | normal deployment, automatic certs (Caddy) | nothing | both, including NAT (public SFU or TURN) | VPS ~$5–10/mo **[unverified]**; LiveKit Cloud Build $0 under 5,000 participant-minutes **[web]** | Removes the laptop-host problem entirely. Deployment needs Human approval. |
| F | Browser flags (`chrome://flags/#unsafely-treat-insecure-origin-as-secure` on Android Chrome; `--host-resolver-rules`, SPKI pin on desktop) | nothing | per-phone flag; **not available on iOS Safari** | dev/testing only | $0 | Used by the in-repo test to simulate a LAN host without touching `/etc/hosts` or trust stores **[test]**. |

## Recommendation

- **Default for the first version: B** (public certificate for a name that resolves to the laptop) with Caddy as the TLS front for both the game server and LiveKit. Phones need nothing. One-time setup by whoever hosts; renewals automated. If no DNS account is wanted, **A** is the zero-account fallback with a per-phone CA install and the security caveat above.
- **If the group ends up hosting on a VPS (E)**, the same Caddy config applies and the LAN problem disappears; this is also the only option that fixes home play without TURN work.
- In-person mode with voice off needs no certificate: text works over `http://192.168.x.x`. But the lobby's "check microphone" step must then say clearly that voice needs the https link.

## Interaction with the provider choice

- Self-hosted LiveKit: one proxy, two upstreams (game server, LiveKit signaling). ICE/TCP port and UDP range stay plain; they are encrypted by DTLS and not subject to secure-context rules.
- LiveKit Cloud: signaling is already `wss://` with a public certificate, so only the game page needs HTTPS. That halves the work but does not remove it: the page origin on the laptop still needs A, B or C.
- Any other SFU: same two-hop requirement; mediasoup, Janus, Galène all need a TLS front or their own certificate.

## What the in-repo test shows (`spikes/voice/tests/secure-context.spec.ts`, `npm run test:tls`)

1. `http://camp.local:4302` (name mapped to 127.0.0.1 by a Chromium flag, standing in for a LAN IP): `isSecureContext=false`, `navigator.mediaDevices` undefined.
2. `https://camp.local:4303` with the throwaway certificate and no trust: navigation fails with `net::ERR_CERT_AUTHORITY_INVALID`, which is what a phone without the CA sees.
3. Same URL with the leaf trusted by SPKI pin for that browser process: `isSecureContext=true`, microphone available, LiveKit connected over `wss://camp.local:4303`, audio energy flows between two players.
4. The full 52-check channel-policy suite also passes when every browser goes through the TLS proxy (`npm run test:tls`).

Nothing was installed into any system or browser trust store. Certificates live in `spikes/voice/.certs/` (gitignored), generated by `make-certs.sh` (SHA-256; LibreSSL's default SHA-1 signature is rejected by Node).

Not tested: real iOS/Android trust installation, DNS-01 issuance, router rebind behaviour, Caddy itself.
