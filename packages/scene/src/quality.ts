// Scene cost modes. PURE resolver; the scene applies the result.
//   off  : no renderer at all (no canvas, no frame loop). For test suites that do not measure visuals.
//   low  : DPR 1, 30 fps cap, no particles/sway, lightmap every other frame. Low-end devices, headless checks.
//   high : full.
// Precedence: explicit option > page override (globalThis.__MOONVEIL_SCENE, set by a harness init script) > auto.
export type Quality = 'off' | 'low' | 'high';
export type QualityOption = Quality | 'auto';
export const SCENE_OVERRIDE_KEY = '__MOONVEIL_SCENE';   // proposed harness knob; env mirror: MOONVEIL_SCENE=off|low|high

export interface QualityEnv {
  override?: unknown;          // globalThis.__MOONVEIL_SCENE
  webdriver?: boolean;         // navigator.webdriver (automation / headless)
  reducedMotion?: boolean;     // prefers-reduced-motion
  cores?: number;              // navigator.hardwareConcurrency
  memoryGb?: number;           // navigator.deviceMemory
}

export function resolveQuality(option: QualityOption | undefined, env: QualityEnv): Quality {
  if (option && option !== 'auto') return option;
  const o = env.override;
  if (o === 'off' || o === 'low' || o === 'high') return o;
  if (env.webdriver) return 'low';
  if ((env.cores ?? 8) <= 4 || (env.memoryGb ?? 8) <= 4) return 'low';
  return 'high';
}

// Frame cap for a mode; reduced motion renders at a very low rate regardless of mode.
export function frameCap(q: Quality, reducedMotion: boolean): number {
  if (q === 'off') return 0;
  if (reducedMotion) return 4;
  return q === 'low' ? 30 : 60;
}

export function readQualityEnv(g: typeof globalThis): QualityEnv {
  const nav = (g as { navigator?: Navigator }).navigator;
  const mm = (g as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  return {
    override: (g as Record<string, unknown>)[SCENE_OVERRIDE_KEY],
    webdriver: !!nav?.webdriver,
    reducedMotion: !!mm?.('(prefers-reduced-motion: reduce)').matches,
    cores: nav?.hardwareConcurrency,
    memoryGb: (nav as { deviceMemory?: number } | undefined)?.deviceMemory,
  };
}
