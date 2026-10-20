# Moonveil app icon

Original crescent sheltering a campfire on midnight forest teal. No text, role imagery, downloaded assets or third-party marks. Warm ivory/amber/wood matches the camping direction. Creative choice: an opaque square plate; platform masks supply rounded corners.

## Files / handoff

- `master.png`: untouched built-in imagegen output, 1254×1254 (requested 1024 square; tool returned 1254 square).
- `master-padded.png`: local production master, same dimensions. Generated artwork scaled to 90%, centered on a solid teal plate. Original margins retained; meaningful artwork stays within the central mask-safe circle. See circular crop on the sheet.
- `preview-sheet.png`: 1480×1120 local AppKit sheet. Native 16/32/48/180/512 px on light/dark surrounds, simulated browser tabs, circular app masks and a separately labelled nearest-neighbor 6× enlargement of 16 px. View at 100% for native-size assessment. No browser was run.
- `export/favicon.ico`: 16/32/48 px, 32-bit BGRA DIB frames with opaque AND masks.
- `export/favicon-32.png`: 32×32.
- `export/apple-touch-icon.png`: 180×180.
- `export/icon-192.png`, `export/icon-512.png`: 192×192 and 512×512; reserved for future manifest integration.
- `export/favicon-16.png`, `export/favicon-48.png`: inspection companions matching the ICO frames.
- `PROMPT.txt`: exact generation prompt. `derive.swift`: reproducible local derivation and preview layout, no drawn replacement for the generated mark.

UI owner places/wires the exports. No app HTML, manifest, runtime code or deployment changes here. All sizes use the same composition/padding; no separate simplified artwork. PNGs are locally re-encoded/compressed by AppKit, without the original generation metadata; no lossy palette quantization. ICO is ~15 KB; large PNG ~247 KB (subtle generated shading retained).

## Honest size read

- 16 px: ivory crescent and orange/gold flame remain separate; camping association is strongest with the larger versions as context. Crossed logs become a warm base, and their grain disappears. The tiny fire is less explicit than at 32 px; no claim that log details survive.
- 32/48 px: crescent, flame and crossed logs read together. Broad color separation carries the icon on both surrounds.
- 180/512 px: clean curves, warm highlights and wood detail. Generator added mild shading/grain despite the flat/no-texture instruction; retained because it fits the camping materials and does not carry essential meaning.
- App mask crop: all essential shapes remain visible. Full opaque square avoids double-rounded corners; no manifest `purpose` is wired or claimed tested on a device.

## Tool / provenance / licence

Generated 2026-10-20 with the actual built-in `image_gen.imagegen` tool, following the `imagegen` skill (built-in mode). One call, no input/reference images, no edits or follow-up generations. No API CLI, API key, paid assets, installs, sign-ups or browser automation. Tool did not expose a selectable model/version; do not infer one. Original prompt-directed Moonveil artwork; no artist/brand imitation requested. No third-party asset licence is required for incorporated material because none was used. Repository terms apply to the local script/notes; generated artwork remains subject to the image service's applicable terms. No separate open-source art licence is asserted.

Automatic save outside Moonveil, copied read-only into this worktree; original left in place:

```text
Directory: /Users/long/.codex-runtime/peer/generated_images/01a14e4b-f6b8-7f41-b96b-7c1482d9ad5a
File: exec-0b02cb6e-249a-4e94-a36d-4469b28dbfac.png
Full path: /Users/long/.codex-runtime/peer/generated_images/01a14e4b-f6b8-7f41-b96b-7c1482d9ad5a/exec-0b02cb6e-249a-4e94-a36d-4469b28dbfac.png
This task: 1 file, 1,255,867 bytes.
The same directory also contains the three earlier costume-generation outputs;
those are not new icon outputs. Nothing there was moved or deleted.
```

All local derivation and Swift module caches are inside `.worktrees/art-icon`. Reproduce from its root:

```sh
mkdir -p .cache/clang
CLANG_MODULE_CACHE_PATH="$PWD/.cache/clang" SWIFT_MODULECACHE_PATH="$PWD/.cache/clang" swift docs/visual/icon/derive.swift
python3 docs/visual/icon/verify.py
```

Validation: native-size sheet inspected locally; PNG signatures, dimensions, CRCs and opaque alpha checked; ICO directory/DIB sizes, masks and pixels checked against PNG companions. One initial local export attempt failed because AppKit could not create an RGB three-channel drawing context; changed its bitmap context to RGBA, then all exports succeeded. No game suites or browser/device tests needed or run for this asset-only delivery.
