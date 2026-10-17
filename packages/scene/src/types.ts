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
  hat: (typeof HATS)[number];
  extra: (typeof EXTRAS)[number];
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
  labelLayout?: boolean | 'v1';   // default true: clamp on screen, lift ≤ 1 label height, leader line when displaced, smaller labels at 13+ seats; 'v1' = first version (lift ≤ 3, no leaders); false = off (captures only)
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
  // dev/test helpers
  time(): number;
  perf(): PerfStats | null;
  perfReset(): void;
  walkLocal(x: number, y: number): void;
  localPose(): Pose | null;
  night(): number;
  destroy(): void;
}
