# Game UI: revised art direction pass (for review, not approved)

Branch `game-ui-art` (from candidate b7bd170). Applies PROJECT_BRIEF.md "Revised art direction" (2026-10-17) to the theme layer only;
flows, hooks (SELECTORS.md), accessibility and checks are unchanged.

## What changed (all in `ui/theme/tokens.css`, `ui/theme/skin.css`, `ui/layout.css`, `ui/components/Icon.tsx`)
- Palette: muted forest green / charcoal surfaces, warm off-white ink, amber accent for every skin (night keeps amber as fire light instead of purple moonlight; ghost skin is desaturated mist). Team colours and status colours desaturated; contrast tokens kept ≥ 4.5:1 (layout checks re-run before review).
- Framing: radii 4–8 px instead of 16–24, flat cards with 1 px lines, no blur, no glow (speaking indicator = thin amber outline; ghosts = faint outline). Role card is a flat panel with an amber rule, left-aligned.
- Type: system sans (Inter / SF Pro / Segoe) instead of rounded; weights 500–600; wordmark in small caps amber.
- Icons: inline SVG line icons (chat, role card, help, settings, mic, mic-off, close, warning, ghost, dead, hat, check) replace all emoji decoration; hats on avatars are a small line glyph.
- Avatar colours muted to match.

## Open for the visual owner's shared tokens
Palette and type tokens here are a first pass; when docs/visual proposes shared tokens, replace the values in `tokens.css` (one file).
Captures: `docs/ui/screens-art/` (phone portrait + laptop; emulation).
