// Scene theme overlays: DEV-ONLY preview switch (scene dev page ?theme=halloween, SceneOptions.theme).
// Honoured only in a Vite dev build; never from the wire (SceneInput has no theme) and never in a production bundle
// (the overlay module is imported dynamically behind the same guard, so the build drops it). No seasonal auto-activation.
export type SceneTheme = 'halloween';

// PURE: the theme actually applied.
export function activeTheme(option: unknown, devBuild: boolean): SceneTheme | null {
  return devBuild && option === 'halloween' ? 'halloween' : null;
}
