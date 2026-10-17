# 0008: Playtest hosting candidates (history)

Status: history, 2026-10-17. Superseded by **0009** (Human chose Render + LiveKit Cloud). Kept for the comparison and the voice-minutes estimate. Full text: this file at `ee1d7d5`.

## What was compared (checked 2026-10-17)
- **A, all-in-one VM** (server + Caddy TLS + self-hosted LiveKit): Hetzner Cloud (prices unverified), Fly.io (~$9/month for 1 GB + volume + IPv4; UDP needs specifics), Oracle Always Free ($0; idle-reclamation risk).
- **B, split**: Railway (game server + volume, ~$5/month Hobby) + LiveKit Cloud Build (voice).
- Not chosen at the time: sleeping free tiers without a disk, because they lose in-memory rooms. 0009 §3 treats that trade-off for Render Free explicitly.

## LiveKit Cloud Build (still used by 0009)
- $0, no card; 5,000 WebRTC participant-minutes, 50 GB downstream/month, 100 concurrent participants. Over the allowance is a hard cap: new connections fail and nothing is billed. Resets on the 1st (livekit.com/pricing, docs.livekit.io quotas; verified 2026-10-17).
- **Estimate**, 10 players, 30-minute match, from the channel model (lobby, living by day, wolves at night, ghosts, moderator): ~400–460 participant-minutes (~380 if counted per identity). So **~10–12 voice matches/month** within the cap. Peak ~23 connections per match, so ~4 matches at once.

## Open voice questions (moved to the voice owner's Cloud doc, linked from 0009 §5)
Token revocation on Cloud; room rotation vs the 10 s session minimum; `hidden` grants and permission flips; no auto-create of stale rooms; TURN/region; the client error at the hard cap; whether `LIVEKIT_URL` and `LIVEKIT_PUBLIC_WS` share a host.
