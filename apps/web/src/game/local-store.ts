// Local-only preferences and private notes. Nothing here is game state and nothing is secret from the
// server's point of view: notes are the player's own guesses, never sent anywhere.
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'vi';
export interface Settings {
  lang: Lang;
  sound: boolean;
  reducedMotion: 'system' | 'on' | 'off';
}

const SETTINGS_KEY = 'moonveil.ui.settings';
const NOTES_KEY = (code: string) => `moonveil.ui.notes.${code}`;

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

let settings: Settings = read<Settings>(SETTINGS_KEY, { lang: detectLang(), sound: true, reducedMotion: 'system' });
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

/** Private suspect notes per seat index: 'suspect' | 'trust' | null. Keyed by room code. */
export type Note = 'suspect' | 'trust';
let notesCode = '';
let notes: Record<number, Note> = {};
const noteListeners = new Set<() => void>();

export const notesStore = {
  load(code: string) {
    if (notesCode === code) return;
    notesCode = code;
    notes = read<Record<number, Note>>(NOTES_KEY(code), {});
    noteListeners.forEach((fn) => fn());
  },
  subscribe: (fn: () => void) => {
    noteListeners.add(fn);
    return () => noteListeners.delete(fn);
  },
  get: () => notes,
  set(seat: number, note: Note | null) {
    const next = { ...notes };
    if (note) next[seat] = note;
    else delete next[seat];
    notes = next;
    if (notesCode) localStorage.setItem(NOTES_KEY(notesCode), JSON.stringify(notes));
    noteListeners.forEach((fn) => fn());
  },
};

export function useNotes(code: string): Record<number, Note> {
  notesStore.load(code);
  return useSyncExternalStore(notesStore.subscribe, notesStore.get);
}
