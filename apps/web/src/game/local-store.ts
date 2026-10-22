// Local-only preferences. Nothing here is game state.
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'vi';
export interface Settings {
  lang: Lang;
  sound: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  /** D6 (2026-10-17): moderator narration cues on by default; approved/neutral lines only. */
  modNarration: boolean;
  /** Scene ambience audio (procedural). Starts after a gesture. */
  ambience: boolean;
  /** Camp scene canvas. Off = panels only (low-end devices, accessibility, automated checks). */
  scene: boolean;
  /** Cosmetic theme, this device only (docs/ui/THEMES.md). Default 'normal'; never from the server, no calendar. */
  theme: 'normal' | 'halloween';
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

let settings: Settings = read<Settings>(SETTINGS_KEY, { lang: detectLang(), sound: true, reducedMotion: 'system', modNarration: true, ambience: false, scene: true, theme: 'normal' });
if (settings.theme !== 'halloween') settings = { ...settings, theme: 'normal' };   // anything else stored reads as Normal
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

