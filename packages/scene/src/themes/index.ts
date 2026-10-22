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
// wait for the scene graph. `set()` resolves with the theme actually SHOWN when it settles ('halloween' = attached).
// `onChange` reports the overlay now shown (null = normal); `onError` gets load/attach failures (scene stays normal,
// the next 'halloween' choice retries).
export class ThemeController {
  private want: SceneTheme = 'normal';
  private make: (() => ThemeOverlayLike) | null = null;
  private loading: Promise<void> | null = null;
  private active: ThemeOverlayLike | null = null;
  private ready = false;
  private dead = false;
  private readyWait: Promise<void>;
  private release!: () => void;
  private load: OverlayLoader;
  private onChange: (overlay: ThemeOverlayLike | null) => void;
  private onError: (e: unknown) => void;
  loads = 0;   // times the overlay code was requested (at most once per scene, plus retries after a failure)

  constructor(load: OverlayLoader, onChange: (overlay: ThemeOverlayLike | null) => void, onError: (e: unknown) => void = () => {}) {
    this.load = load; this.onChange = onChange; this.onError = onError;
    this.readyWait = new Promise((r) => { this.release = r; });
  }

  get theme(): SceneTheme { return this.want; }                         // chosen
  get shown(): SceneTheme { return this.active ? 'halloween' : 'normal'; }   // on screen
  get overlay(): ThemeOverlayLike | null { return this.active; }

  // the scene graph exists: a pending choice attaches now
  sceneReady() { this.ready = true; this.release(); }
  set(option: unknown): Promise<SceneTheme> {
    this.want = normalizeTheme(option);
    return this.apply().then(() => this.shown, (e: unknown) => { this.onError(e); return this.shown; });
  }
  // scene destroyed or never built: pending calls settle ('normal'), nothing attaches again
  destroy() { this.dead = true; this.drop(); this.release(); }

  private drop() { if (this.active) { this.active.detach(); this.active = null; this.onChange(null); } }

  private async apply(): Promise<void> {
    if (this.dead) return;
    if (this.want === 'normal') { this.drop(); return; }
    if (!this.make) {
      this.loading ??= (async () => { this.loads++; this.make = await this.load(); })();
      try { await this.loading; } catch (e) { this.loading = null; throw e; }   // a failed load can be retried
    }
    if (!this.ready) await this.readyWait;
    // a newer choice, a destroyed scene, or already shown: nothing to do
    if (this.dead || this.want !== 'halloween' || this.active) return;
    this.active = this.make!();
    this.onChange(this.active);
  }
}
