# 0002: LAN / HTTPS options for phones (options note, no decision)

Status: options for Human + voice owner (2026-10-16). Paper only. Nothing installed, no certs, no system changes.
Grant d: LiveKit OSS for local implementation/verification only. Hosting, TURN, costs, sign-ups, certs and deploy are unapproved.

## Why it matters
- Secure context = https, `localhost`, 127/8 (MDN Secure Contexts). A LAN IP over http is not one.
- Needs a secure context (MDN):
  - `getUserMedia`: mic check and voice. `navigator.mediaDevices` is `undefined` otherwise.
  - `navigator.clipboard.writeText`: the shell's "Copy invite link" silently does nothing on LAN http. Fix in shell: fallback.
  - Screen Wake Lock: keeps a phone awake during night steps.
- Works without one: page load, WebSocket game protocol, lobby, game, text.
- Today (local verification): the host browser and Playwright use 127.0.0.1, so they are secure. Nothing needed.

## Scenarios
- **Same room (LAN):** phones reach the host laptop directly.
  - Brief proposal: in-person play defaults to in-game voice off, with private wolf text at night. If that holds, HTTPS is not required for in-person play.
- **Remote players:** need a publicly reachable web server, plus a publicly reachable SFU for voice.
  - LiveKit ports: signal 7880 (behind TLS), WebRTC UDP 50000–60000 (or a single 7882), TCP 7881, TURN/TLS 5349, or 443 without a load balancer (LiveKit ports/firewall doc).
  - An HTTP tunnel does not carry WebRTC media.

## Options
| | Option | Host needs | Phones need | Money | Approvals | Limits / risks |
|---|---|---|---|---|---|---|
| A | HTTP on LAN IP (`HOST=0.0.0.0`) | Nothing new. macOS may prompt to allow incoming connections (a system setting). | Nothing; scan link/QR | 0 | None (local) | No mic/voice, clipboard or wake lock. Wi-Fi with client isolation (common on guest/office nets) blocks phone→laptop; fallback is the host's own hotspot. LAN IP may change. |
| B | Self-signed cert, click through warning | Generate cert in repo; server TLS option (not built) | Accept a warning on each device | 0 | None | Teaches clicking through warnings. **Unverified:** secure-context status after click-through, and iOS Safari `wss` with an untrusted cert. Not recommended. |
| C | Local CA (mkcert-style) | Install CA into system trust store (system change) | iOS: install profile, then Settings > General > About > Certificate Trust Settings, full trust (Apple 102390). Android: user CA. **Unverified** whether Chrome honours it; Android apps targeting API 24+ trust only system CAs by default (Android network security config). | 0 | Cert install = unapproved (grants b, d) | mkcert: CA key "gives complete power to intercept secure requests". Removal needed afterwards. Heavy for colleagues. Not recommended. |
| D | Own domain, Let's Encrypt DNS-01, A record → LAN IP | ACME client, DNS-provider API key on host | Nothing | Domain fee (recurring) | Domain purchase + registrar/ACME sign-up = unapproved | DNS-01 works without public reachability; LE: "Keeping API credentials on your web server is risky". Some routers/resolvers drop public answers that point to private IPs (rebinding protection; network-dependent, unverified here). Re-point on IP change. LAN only. |
| E | Quick tunnel (Cloudflare TryCloudflare) | Run `cloudflared` | Nothing | 0 | Public exposure = deployment-like; needs approval | "No uptime guarantee", 200 in-flight requests, testing only (Cloudflare doc). WebSockets not stated, **unverified**. TLS ends at Cloudflare, so **game secrets transit a third party**. No WebRTC media. |
| F | Tailscale + `tailscale cert` (ts.net, LE) | Account; join tailnet | Install app and join tailnet (likely per device; doc doesn't state) | Plan-dependent | Sign-up = unapproved | Machine names "published in the public ledger" (CT logs). Too heavy for colleagues. |
| G | Hosted deployment (VPS + domain + LE; LiveKit with UDP/TCP/TURN) | Server ops | Nothing | Recurring VPS + domain (+ bandwidth) | Cost, sign-ups, deployment = unapproved | Only option covering same-room and remote with no device setup. Secrets live on a server we operate. Needs hosting decision with the voice owner. |

## Proposal (for decision)
1. **First in-person playtest: A, voice off.** Zero cost, zero device setup, matches the brief's in-person proposal.
   - Check beforehand that the venue Wi-Fi allows phone→laptop; otherwise use the host's hotspot.
   - Shell work (foundation, small): detect `!isSecureContext` and show "voice unavailable on this connection" instead of a mic check; copy-link fallback; LAN URL + QR on the host screen.
2. **In-person voice or any remote play needs G.** Optionally D for LAN-only voice if a domain is bought. Both need Human cost/sign-up approval and a hosting plan with the voice owner.
   - E only for a one-off remote smoke test, accepting third-party TLS termination.
3. **Not recommended:** B and C.

## Not built yet (server, when an option is chosen)
- Optional TLS listener (`HTTPS_CERT`/`HTTPS_KEY`).
- Host URL/QR display.
- Behind a tunnel or proxy, keep the same-origin check: it compares `Origin` with `Host`, so the proxy must preserve `Host`.
