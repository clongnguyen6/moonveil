// Scene contract. The scene is a pure function of (SceneInput snapshot, server-filtered PoseFrames, local input).
// Nothing here may carry a secret: the shell copies only public projection fields into SceneInput.
export type SeatId = string;
export type SeatKind = 'player' | 'moderator';
export type Phase = 'lobby' | 'day' | 'night' | 'ended';

export const SKINS = ['fair', 'light', 'tan', 'brown', 'deep'] as const;
export const TOPS = ['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate', 'clay', 'sky', 'bark', 'rose'] as const;
export const HAIRS = ['short', 'long', 'bun', 'curly', 'bald'] as const;
export const HAIR_COLORS = ['black', 'brown', 'chestnut', 'blond', 'ink', 'red'] as const;
export const HATS = ['none', 'beanie', 'cap', 'bucket', 'hood', 'flower'] as const;
export const EXTRAS = ['none', 'scarf', 'backpack'] as const;

// Cosmetic only; chosen by the player before roles exist. Never derived from or correlated with a role.
export interface SceneAppearance {
  skin: (typeof SKINS)[number];
  top: (typeof TOPS)[number];
  hair: (typeof HAIRS)[number];
  hairColor: (typeof HAIR_COLORS)[number];
  hat: (typeof HATS)[number] | (string & {});   // base hat id, or an outfit's headgear id (catalog, ADR 0011)
  extra: (typeof EXTRAS)[number];                // legacy single extra; `front`/`back` win when present
  // Costume fields, aligned with the wire contract proposal { outfit, variant, color, hat, front, back, body? }
  // (color = `top`, body = skin/hair/hairColor above). Scene-side until the wire adapter lands.
  outfit?: string;    // costume id in src/costumes/index.ts ('camper' / absent = base look)
  variant?: string;   // outfit variant, e.g. duck: 'ring' | 'plain'
  front?: string;     // front item id ('none', 'scarf', or an outfit's id)
  back?: string;      // back item id ('none', 'backpack', or an outfit's id)
}

export interface ScenePlayer { seat: SeatId; name: string; appearance: SceneAppearance; connected: boolean }
// Public per the rules projection: alive flag and public death record. Empty in the lobby.
export interface SceneSeatState { seat: SeatId; alive: boolean; death: { cause: string; night: number; day: number } | null }
export interface SceneVoiceGrant { channel: string; listen: boolean; speak: boolean }

export interface SceneInput {
  me: { seat: SeatId; kind: SeatKind };
  players: ScenePlayer[];          // order = campfire seat and tent index, stable for the match
  phase: Phase;
  day: number;
  night: number;
  phaseEndsAt: number | null;
  seats: SceneSeatState[];
  reveal: Record<SeatId, string> | null;   // end-of-match role reveal, all viewers
  voice: SceneVoiceGrant[];
}

export interface Pose { seat: SeatId; x: number; y: number; facing: 1 | -1; moving: boolean }
export interface PoseFrame { poses: Pose[] }

export type CameraMode = 'fit' | 'tight';
export interface SafeArea { top: number; right: number; bottom: number; left: number }

export interface SceneOptions {
  input: SceneInput;
  camera?: CameraMode;         // default: 'tight' on narrow portrait screens, else 'fit'
  perf?: boolean;              // collect per-frame timings (dev)
  resolution?: number;         // device pixel ratio cap, default min(dpr, 2); 'low' forces 1
  // Cost mode. 'auto' (default): page override globalThis.__MOONVEIL_SCENE, else 'low' under automation
  // or on ≤4 cores / ≤4 GB, else 'high'. 'off' mounts nothing (no canvas, no frame loop).
  quality?: 'off' | 'low' | 'high' | 'auto';
  labelLayout?: boolean | 'v1';
  debug?: boolean;                // enables debug read hooks (debugAppearance); off in production
  /** Player-chosen cosmetic theme (Settings, local only); default 'normal'. Never set from the wire. 'halloween' loads
   *  the overlay as a lazy chunk on first use. Change at runtime with SceneHandle.setTheme. See docs/visual/MOUNT.md. */
  theme?: 'normal' | 'halloween';
  // Experimental cost knobs for A/B measurement (harness only; defaults = current behaviour).
  experimental?: { antialias?: boolean; fpsCap?: number; lightmapOnChange?: boolean; ripples?: boolean; vignette?: boolean };   // default true: clamp on screen, lift ≤ 1 label height, leader line when displaced, smaller labels at 13+ seats; 'v1' = first version (lift ≤ 3, no leaders); false = off (captures only)
}

export interface PerfStats { n: number; frame: Stat; update: Stat; lightmap: Stat; render: Stat }
export interface Stat { avg: number; p95: number; max: number }

export interface SceneHandle {
  readonly ready: Promise<void>;
  readonly quality: 'off' | 'low' | 'high';   // resolved cost mode
  setInput(input: SceneInput): void;
  setPoses(frame: PoseFrame): void;
  setSpeaking(seats: SeatId[]): void;
  on(event: 'move', cb: (pose: Pose) => void): () => void;
  on(event: 'emote', cb: (emote: string) => void): () => void;
  on(event: 'tap', cb: (hit: { x: number; y: number; seat: SeatId | null }) => void): () => void;   // tap: world units + seat if an avatar was hit; a tap on empty ground also walks there when allowed
  emote(emote: string): void;
  setSpeakingLocal(on: boolean): void;   // local mic state, shown immediately (server list follows)
  setAudio(on: boolean): Promise<void>;
  setCamera(mode: CameraMode): void;
  setSafeArea(insets: Partial<SafeArea>): void;   // HUD overlap in CSS px; the camera frames the remaining area
  resize(): void;                                 // optional: the scene also observes the host with ResizeObserver
  // Local-only draft of the local seat's look while the player edits it. Renders on the local avatar only,
  // re-baked in place (position, pose, facing, animation and intent preserved); emits nothing; other seats are
  // unaffected. Stays active across snapshot updates until cleared with null, which restores the snapshot look.
  setLocalAppearanceOverride(appearance: SceneAppearance | null): void;
  // Test-only (requires opts.debug): the appearance an avatar currently renders, or null.
  debugAppearance(seat: SeatId): SceneAppearance | null;
  // debug: camera scale, smallest on-screen camper name label (px) and the screen box of visible campers (not ghosts) incl. labels; null when debug is off
  // debug: stage layer order, whether name labels sit above every effect layer, and how many labels are in the label layer
  // Switch the theme without remounting: 'halloween' lazy-loads the overlay once; 'normal' removes every decoration and
  // the plum night. Resolves with the theme actually SHOWN when the call settles: 'halloween' = overlay attached (waits
  // for the scene to be built); 'normal' = no overlay (chosen, superseded by a later call, or failed to load: a warning
  // is logged and the next 'halloween' call retries). Never rejects.
  setTheme(theme: 'normal' | 'halloween'): Promise<'normal' | 'halloween'>;
  // Result of the mount option `theme`, same meaning as setTheme's result ('normal' when no theme was asked for).
  readonly themeApplied: Promise<'normal' | 'halloween'>;
  // debug: active theme overlay, whether it animates (high, no reduced motion) and its decoration counts; null when debug is off
  debugTheme(): { theme: string | null; animate: boolean; counts: { pumpkins: number; bulbs: number; ornaments: number; leaves: number } | null } | null;
  debugLabels(): { order: string[]; aboveEffects: boolean; labels: number; inLabelLayer: number } | null;
  debugCamera(): { scale: number; labelPx: number; view: { w: number; h: number }; safe: SafeArea; avatars: { x0: number; y0: number; x1: number; y1: number } | null } | null;
  // dev/test helpers
  time(): number;
  perf(): PerfStats | null;
  perfReset(): void;
  walkLocal(x: number, y: number): void;
  localPose(): Pose | null;
  night(): number;
  destroy(): void;
}
