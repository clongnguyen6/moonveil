# @moonveil/voice

LiveKit adapter for Moonveil voice. Owner: voice scope. Decision and evidence: `docs/voice/`.

- `src/server/*` — `LiveKitVoiceGateway` (implements the server's `VoiceGateway`; adds `commit`, `sessions`), pure grant→permission mapping and rotation planning, token minting, `LiveKitBackend` + `FakeBackend`.
- `src/client/*` — browser `VoiceClient` (next increment).
- `tooling/livekit.mjs` — pinned LiveKit 1.13.10 for dev/tests; every write under `.cache/livekit/` (Linux release tarball → source build with in-repo Go dirs and HOME → Docker fallback).

```
node scripts/env.mjs npm run test -w @moonveil/voice        # unit tests (FakeBackend, no LiveKit)
node scripts/env.mjs npm run typecheck -w @moonveil/voice
node scripts/env.mjs node packages/voice/tooling/livekit.mjs start --port 4300   # local LiveKit (ports 4300–4399)
```

Rules the code enforces: no grant ⇒ not connected; `visible:false` ⇒ hidden participant; any member leaving a channel ⇒ that channel's room rotates (new name, new tokens, old room deleted; `auto_create` off); permission flips stay in-room; API calls per commit run in parallel, shuffled.
