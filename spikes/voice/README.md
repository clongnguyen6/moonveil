# Voice spike (LiveKit, local)

Proof that Moonveil's channel rules can be enforced server-side. Not product code.

## Layout
- `server.mjs` — stand-in game server: state → entitlements → LiveKit tokens + RoomService enforcement. Port 4302.
- `web/` — minimal client, one LiveKit Room per entitled channel; `window.__voice` exposes snapshots and attack hooks.
- `tests/channels.spec.ts` — 10-session Playwright proof (fake mic = 440 Hz tone).
- `config/livekit.yaml` — LiveKit on 127.0.0.1:4300 (HTTP/WS), 4301 (ICE/TCP), UDP 4310–4350.
- `.bin/`, `.browsers/`, `.npm-cache/` — gitignored; everything the spike needs lives here, no global installs.

## Setup (all inside this directory)
```
npm install                                   # uses .npm-cache via .npmrc
PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers npx playwright install chromium
# LiveKit server: no macOS release binary exists, build from source (needs Go >= 1.26):
mkdir -p .bin && cd .bin && curl -sSL -o livekit-src.tar.gz https://github.com/livekit/livekit/archive/refs/tags/v1.13.10.tar.gz \
  && mkdir -p livekit-src && tar xzf livekit-src.tar.gz -C livekit-src --strip-components=1 && cd livekit-src \
  && GOCACHE=$PWD/../gocache GOMODCACHE=$PWD/../gomodcache GOPATH=$PWD/../gopath GOTMPDIR=$PWD/../gotmp GOTOOLCHAIN=local GOFLAGS=-mod=mod \
     go build -o ../livekit-server ./cmd/server
# Linux: download livekit_1.13.10_linux_<arch>.tar.gz from the same release instead.
```

## Run
```
npm test            # starts livekit + spike server if not running, runs the suite, stops what it started
```
Manual: `npm run livekit`, `npm run server`, open http://127.0.0.1:4302/?player=p01 (same page with other ids), drive state with
`curl -X POST localhost:4302/api/{setup,phase,kill,mode}`.
