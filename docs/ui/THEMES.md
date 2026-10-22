# Themes

Moonveil has two looks: **Normal** (default) and **Cute Halloween** (plum panels, pumpkin-orange accents, a tiny 🎃/🦇
by panel titles, and pumpkins, string lights, ghost ornaments and leaves in the camp).

- **Turn it on:** Settings → *Theme* → *Cute Halloween*. **Turn it off:** Settings → *Theme* → *Normal*. It switches at
  once, no reload, in the lobby and during a match.
- **Default Normal.** The choice is per device (saved in this browser, like the other settings). It is never set by the
  server, never forced on a room, and never switched on by the date.
- **Same game.** Cosmetic only: rules, roles, costumes, chat, controls and sizes are unchanged, and it looks the same for
  every role (also at night). Text keeps ≥ 4.5:1 contrast and controls stay ≥ 44 px.
- **Nothing extra for default players.** The Halloween stylesheet (~1.4 KB) and the camp decorations (~7.5 KB) are
  separate files, downloaded only the first time someone chooses Cute Halloween.
- **Slow devices and reduced motion.** On the `low` scene profile and with reduced motion the decorations are static (no
  flicker or sway). With the camp scene turned off, only the panel colours change.
- **If it can't load** (e.g. a dropped connection): everything stays Normal, the setting goes back to *Normal*, and a
  short note says so. Choosing it again retries.

For developers: `ui/theme/theme.ts` applies the UI stylesheet and the scene overlay together (`html[data-theme]` is set
only when both are shown); the scene side is `docs/visual/MOUNT.md` "Theme". Dev shortcut: `?theme=halloween|normal` on
the stub page sets the same setting. Checks: stub `check.mjs` 11o, `layout-check.mjs` with `THEME=halloween`,
`ui/dev/theme-check.mjs` (real server, scene on).
