# Install incident: Homebrew `livekit` formula (2026-10-16)

Scope: voice peer (87bbae25) ran a global Homebrew install. The workspace protocol limits writes to Moonveil, so this was outside authorization. Reported for Human-approved rollback. Nothing has been uninstalled or stopped.

## 1. Commands run and when

Run once, in the background, from `/Users/long/repo/games/moonveil` at about 14:06 +07 on 2026-10-16 (receipt time 14:06:29, output captured 14:06:30):

```
brew info livekit; brew install livekit; which livekit-server && livekit-server --version
```

Earlier read-only probe at ~14:05: `brew list --versions livekit` (no change).

## 2. What was installed or changed

From the captured install output and `INSTALL_RECEIPT.json`:

| Item | Detail |
|---|---|
| Formula | `livekit` 1.13.10 (homebrew-core, Apache-2.0), poured from bottle `livekit--1.13.10.arm64_tahoe.bottle.tar.gz` |
| Files | `/opt/homebrew/Cellar/livekit/1.13.10` (8 files, 53.6 MB); symlinks `/opt/homebrew/bin/livekit-server` and `/opt/homebrew/opt/livekit` |
| Runtime dependencies | none (`runtime_dependencies: []`; `brew deps --installed livekit` is empty) |
| Dependents | none (`brew uses --installed livekit` is empty) |
| Upgrades of other formulae | none in the output (no "Upgrading" lines) |
| Taps added | none. Existing taps unchanged: facebook/fb, hashicorp/tap, mongodb/brew, stripe/stripe-cli |
| Homebrew auto-update | no "Updating Homebrew" line in the output; `homebrew_version` in the receipt is 7.0.9-94-g92b8ea8 |

## 3. Services and processes

- `brew services list` has no livekit entry.
- `launchctl list` has no entry mentioning livekit.
- No `livekit-server` process exists (`pgrep -lf livekit-server` is empty). The binary was executed once with `--version` only; it never listened on any port.

## 4. Minimal rollback proposal

```
brew uninstall livekit
# optional, removes the downloaded bottle from the brew cache:
brew cleanup livekit
```

Impact: removes `/opt/homebrew/Cellar/livekit/1.13.10` and the two symlinks. No dependencies would be removed (the formula has none), so no other formula on the machine is affected. Other users of the shared machine lose only the `livekit-server` command that did not exist before 14:06 today.

## Replacement inside Moonveil

The spike now uses a LiveKit release binary downloaded to `spikes/voice/.bin/` (gitignored) and never calls the Homebrew binary. See `docs/voice/RECOMMENDATION.md`.
