// Local-only preferences. Nothing here is game state.
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'vi';
export interface Settings {
  lang: Lang;
  sound: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  /** PROVISIONAL aids pending Human decisions (kept behind settings, default off). */
  modNarration: boolean;
  /** Scene ambience audio (procedural). Starts after a gesture. */
  ambience: boolean;
  /** Camp scene canvas. Off = panels only (low-end devices, accessibility, automated checks). */
  scene: boolean;
}

const SETTINGS_KEY = 'moonveil.ui.settings';

function detectLang(): Lang {
  const l = (navigator.language || '').toLowerCase();
  return l.startsWith('vi') ? 'vi' : 'en';
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

let settings: Settings = read<Settings>(SETTINGS_KEY, { lang: detectLang(), sound: true, reducedMotion: 'system', modNarration: false, ambience: false, scene: true });
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const settingsStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => settings,
  set(patch: Partial<Settings>) {
    settings = { ...settings, ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    emit();
  },
};

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}

