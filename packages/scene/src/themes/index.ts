// Scene themes: player-chosen, opt-in cosmetic overlays (Settings "Theme: Normal / Cute Halloween", local only).
// Never from the wire (SceneInput has no theme), never forced room-wide, no calendar activation. Default 'normal'.
// The overlay code is a separate lazy chunk: imported the first time a player selects it, never for default users.
export type SceneTheme = 'normal' | 'halloween';

// PURE: any value other than an exact theme id is 'normal'.
export function normalizeTheme(option: unknown): SceneTheme {
  return option === 'halloween' ? 'halloween' : 'normal';
}

// What an overlay must offer the scene. Structural, so this file imports nothing heavy (the default bundle carries only it).
export interface ThemeOverlayLike { readonly id: string; readonly night: { ambient: number; wash: number }; detach(): void }
// Loads the overlay code (dynamic import) and returns a factory that builds + attaches an overlay to the current scene.
export type OverlayLoader = () => Promise<() => ThemeOverlayLike>;

// PURE state machine for the chosen theme: lazy load once, ignore stale loads after a newer choice, remove cleanly,
// wait for the scene graph. `onChange` reports the overlay now shown (null = normal).
export class ThemeController {
  private want: SceneTheme = 'normal';
  private make: (() => ThemeOverlayLike) | null = null;
  private loading: Promise<void> | null = null;
  private active: ThemeOverlayLike | null = null;
  private ready = false;
  private dead = false;
  private load: OverlayLoader;
  private onChange: (overlay: ThemeOverlayLike | null) => void;
  loads = 0;   // times the overlay code was requested (at most once per scene)

  constructor(load: OverlayLoader, onChange: (overlay: ThemeOverlayLike | null) => void) { this.load = load; this.onChange = onChange; }

  get theme(): SceneTheme { return this.want; }
  get overlay(): ThemeOverlayLike | null { return this.active; }

  // the scene graph exists: apply a choice made before it was built
  sceneReady(): Promise<void> { this.ready = true; return this.apply(); }
  set(option: unknown): Promise<void> { this.want = normalizeTheme(option); return this.apply(); }
  destroy() { this.dead = true; this.drop(); }

  private drop() { if (this.active) { this.active.detach(); this.active = null; this.onChange(null); } }

  private async apply(): Promise<void> {
    if (this.dead) return;
    if (this.want === 'normal') { this.drop(); return; }
    if (!this.make) {
      this.loading ??= (async () => { this.loads++; this.make = await this.load(); })();
      try { await this.loading; } catch (e) { this.loading = null; throw e; }   // a failed load can be retried
    }
    // a newer choice, a destroyed or unbuilt scene, or already shown: nothing to do
    if (this.dead || this.want !== 'halloween' || !this.ready || this.active) return;
    this.active = this.make!();
    this.onChange(this.active);
  }
}
