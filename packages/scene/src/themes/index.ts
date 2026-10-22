// Scene theme overlays: DEV-ONLY preview switch (scene dev page ?theme=halloween, SceneOptions.theme).
// Honoured only in a Vite dev build; never from the wire (SceneInput has no theme) and never in a production bundle
// (the overlay module is imported dynamically behind the same guard, so the build drops it). No seasonal auto-activation.
export type SceneTheme = 'halloween';

// PURE: the theme actually applied.
export function activeTheme(option: unknown, devBuild: boolean): SceneTheme | null {
  return devBuild && option === 'halloween' ? 'halloween' : null;
}

export function isDevBuild(): boolean {
  return (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
}

// Night colours the theme changes (camp look otherwise unchanged). Base: ambient 0x3a3c92, wash 0x6a5aa8.
export const THEME_NIGHT: Record<SceneTheme, { ambient: number; wash: number }> = {
  halloween: { ambient: 0x46346f, wash: 0x7c4c9c },   // slightly plum
};
