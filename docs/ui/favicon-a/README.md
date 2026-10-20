# Favicon A: wiring and .ico packaging

Owner's choice: alternative A (transparent silhouette), art by the art owner in `docs/visual/icon/favicon-v2/` (5ee3976; see
its README for generation and provenance). Nothing there was edited.

- `apps/web/public/favicon-16.png`, `-32.png`, `-48.png` = byte-identical copies of
  `docs/visual/icon/favicon-v2/alternative-a-16.png`, `-32.png`, `-48.png` (8-bit RGBA, transparent corners).
- `apps/web/public/favicon.ico` was packaged here from exactly those three PNGs by `pack_ico.py` (Python standard
  library only: zlib, struct; no downloads, services or image editors):
  `python3 -I docs/ui/favicon-a/pack_ico.py pack apps/web/public/favicon.ico apps/web/public/favicon-{16,32,48}.png`.
  Three frames, 16/32/48, each a 32-bit BGRA DIB with a 1-bit AND mask set where alpha is 0. Pixels are copied
  unchanged (straight alpha, no resampling or colour change).
- Check: `python3 -I docs/ui/favicon-a/pack_ico.py verify apps/web/public/favicon.ico apps/web/public/favicon-{16,32,48}.png`
  decodes the .ico and compares every RGBA pixel with the PNGs (identical; corners alpha 0). Cross-checked read-only with
  Pillow (same 3 sizes, identical RGBA) and macOS `sips` (48 px, hasAlpha yes).
- Unchanged: `apple-touch-icon.png` (180, opaque plate), `index.html` links, README, `icon-192/512.png` (docs only).
- Served-icon evidence: `apps/web/src/ui/dev/icon-check.mjs` → `docs/ui/screens-icon/` (true size, light and dark).
