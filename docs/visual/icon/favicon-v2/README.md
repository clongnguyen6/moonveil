# Favicon v2 — selection preview only

Recommendation: **A, transparent standalone silhouette**. At native 16 px it removes the dark tile, increases the visible crescent/flame area, and sits more naturally beside the generic neighbours. B is a restrained rounded-plate fallback: bolder fire than current, but still a tile on light chrome. At 32 px both are clearly larger and simpler than current. At 16 px the flame remains a warm fire shape; without logs, “campfire” is less explicit. The crescent is the strongest identity cue. A's teal contour helps on white, while its ivory and amber carry it on dark chrome. No claim of a real-browser or device test.

## Review

- `comparison-sheet.png`: current vs **exactly two alternatives**, true 16/32/48 px on light, dark and cool browser-like grey. Lower mock vertical strips put each between generic circles/triangles, not third-party logos. Inspect at 100% (one image pixel per screen pixel); no enlarged master is used as readability evidence.
- `alternative-a-{16,32,48}.png`: transparent candidate exports.
- `alternative-b-{16,32,48}.png`: rounded plate candidate exports, transparent outside corners.
- `alternative-{a,b}-master.png`: untouched actual generated rasters, each 1280×1280.
- `alternative-{a,b}-clean.png`: cleaned full-size intermediate; `derive.swift` reproduces all local transformations and the sheet.
- Current comparisons load the existing `../export/favicon-{16,32,48}.png` unchanged. Large app icons, original masters, README icon, app files and deployment untouched. No ICO/wiring/adoption until owner selection.

## Generation and local cleanup

Built-in `image_gen.imagegen`, two independent calls with `transparent_background=true`, no input images. Exact prompts in `PROMPTS.md`. Original Moonveil prompt-directed designs; no reference logos, artist imitation, downloaded art, paid API CLI, installs or external services. Tool model/version not exposed. Generated artwork subject to the image service's applicable terms; no separate art licence asserted. Repository has no licence file; no third-party art licence was introduced.

Swift/AppKit performs derivation only; no hand-drawn replacement icon. Re-render source into a known RGBA bitmap, threshold source alpha at 0.5; map generated pixels to three solid fills: ivory `#f5e5b8`, amber `#e99a23`, teal `#173b3b`. Remove generated gradients/shading. For B only, flood-fill exterior transparency and fill enclosed alpha holes with teal (accidental generation artifacts in plate). A's negative spaces remain transparent. Trim to nontransparent bounds and fit the long axis to 93.75% of each export (15/16, 30/32, 45/48 px), centered, preserving aspect and antialiasing at final high-quality downscale. Same treatment for all sizes; no new artwork painted locally. No logs/grain in either generated design.

One initial pixel-processing attempt hit AppKit source-colour-space warnings; stopped it and normalized the source to an RGBA drawing context, then used direct bitmap access. Final derivation ran successfully with empty stderr. All caches and derivation logs are worktree-local. No browser rendering, game checks or adoption performed.

Reproduce from worktree root:

```sh
mkdir -p .cache/clang
CLANG_MODULE_CACHE_PATH="$PWD/.cache/clang" SWIFT_MODULECACHE_PATH="$PWD/.cache/clang" swift docs/visual/icon/favicon-v2/derive.swift
python3 docs/visual/icon/favicon-v2/verify.py
```

## Outside-repo automatic originals

Read-only copies; originals neither moved nor deleted. **2 new files, 2,234,695 bytes total.** Other pre-existing files in the same directory are unrelated earlier outputs.

Directory: `/Users/long/.codex-runtime/peer/generated_images/01a14e4b-f6b8-7f41-b96b-7c1482d9ad5a`

| File (full path) | Bytes |
|---|---:|
| `/Users/long/.codex-runtime/peer/generated_images/01a14e4b-f6b8-7f41-b96b-7c1482d9ad5a/exec-77315605-2c66-4d45-9e22-2929f17b1a0e.png` | 955891 |
| `/Users/long/.codex-runtime/peer/generated_images/01a14e4b-f6b8-7f41-b96b-7c1482d9ad5a/exec-db55e0a0-c9e6-4e23-95af-3d374ef42098.png` | 1278804 |
