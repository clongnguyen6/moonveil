#!/bin/sh
# A/B: the only difference is revoke-before-delete in the gateway (VOICE_REVOKE_ON_CLOSE=0 vs 1).
# Same test files, same seeds (MOONVEIL_TEST_SEED fixed for every room), same time scale, back-to-back,
# machine conditions sampled to .cache/voice-e2e/conditions-ab-<label>.log. Run from the repo root:
#   sh packages/voice/e2e/ab.sh [label]   (needs the heavy-run lock)
set -u
cd "$(dirname "$0")/../../.."
label=${1:-ab}
seed=${MOONVEIL_TEST_SEED:-"voice-ab!"}
scale=${MOONVEIL_TEST_TIME_SCALE:-2}
for variant in off on; do
  case $variant in off) revoke=0;; on) revoke=1;; esac
  cond=".cache/voice-e2e/conditions-$label-$variant.log"
  ( for i in $(seq 1 90); do printf '%s load=%s ' "$(date +%H:%M:%S)" "$(sysctl -n vm.loadavg | tr -d '{}')"; top -l 1 -n 0 2>/dev/null | grep -E 'CPU usage|PhysMem' | tr '\n' ' '; echo; sleep 30; done ) > "$cond" 2>&1 &
  sampler=$!
  echo "=== variant revoke=$variant seed=$seed scale=$scale load=$(sysctl -n vm.loadavg)"
  E2E_PORT=4350 VOICE_E2E_RUN="$label-$variant" VOICE_REVOKE_ON_CLOSE=$revoke MOONVEIL_TEST_SEED="$seed" MOONVEIL_TEST_TIME_SCALE=$scale \
    node scripts/env.mjs npm run e2e -w @moonveil/voice -- -g 'moderator|automatic' > ".cache/voice-e2e-$label-$variant.log" 2>&1
  echo "exit $?"
  grep -E '^\s+(✓|✘|[0-9]+ (passed|failed))|hear-matrix:|per step|window |skipped |settle |tracks still|Error:' ".cache/voice-e2e-$label-$variant.log" | head -60
  kill $sampler 2>/dev/null
  echo "conditions: $(sed -n '1p' "$cond" | cut -c1-60) ... peak $(sort -t= -k2 -n "$cond" | tail -1 | cut -c1-60)"
done
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '{print $9}' | grep -E ':43[0-9]{2}$' || echo "ports 4300-4399 free"
