// Player theme (Settings "Theme", this device only; docs/ui/THEMES.md). Applies the UI accents and the scene overlay
// TOGETHER and keeps them consistent:
//  - 'normal': no Halloween stylesheet (link removed), no data-theme, scene back to normal.
//  - 'halloween': the stylesheet is fetched lazily as a <link> (default users never download it), the scene is asked to
//    switch, and only when BOTH are shown does <html> get data-theme="halloween". If either fails, both stay Normal, the
//    setting returns to Normal (it always shows what is applied) and a short non-blocking note appears; choosing it
//    again retries. Later choices win (sequence number).
// Never from the server, never room-wide, no calendar. Cosmetic only: identical for every role.
import { useSyncExternalStore } from 'react';
import { type Settings, settingsStore } from '../../game/local-store.ts';

export type Theme = Settings['theme'];
/** The scene's theme seam (docs/visual/MOUNT.md "Theme"): resolves with the theme actually shown. */
export interface ThemeScene { setTheme(theme: Theme): Promise<unknown> }

const LINK_ID = 'moonveil-theme-halloween';
let scene: ThemeScene | null = null;
let seq = 0;
let latest: Theme = 'normal';                       // the most recent choice
let cssLoading: Promise<boolean> | null = null;     // one in-flight stylesheet load at a time
let note: 'themeFailed' | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

const cssUrl = async (): Promise<string> => (await import('./halloween.css?url')).default;

function loadCss(): Promise<boolean> {
  if (document.getElementById(LINK_ID)) return Promise.resolve(true);
  cssLoading ??= (async () => {
    let href: string;
    try { href = await cssUrl(); } catch { return false; }
    const link = Object.assign(document.createElement('link'), { id: LINK_ID, rel: 'stylesheet', href });
    const ok = await new Promise<boolean>((res) => { link.onload = () => res(true); link.onerror = () => res(false); document.head.appendChild(link); });
    if (!ok) link.remove();
    return ok;
  })().finally(() => { cssLoading = null; });
  return cssLoading;
}

function showNormalUi() {
  delete document.documentElement.dataset.theme;
  document.querySelectorAll(`#${LINK_ID}`).forEach((el) => el.remove());
}

/** Apply the chosen theme to the UI and (if mounted) the scene. Safe to call repeatedly; the latest call wins. */
export async function applyTheme(want: Theme): Promise<void> {
  const my = ++seq;
  latest = want;
  if (want !== 'halloween') {
    showNormalUi();
    await scene?.setTheme('normal').catch(() => undefined);
    return;
  }
  let ok = await loadCss();
  if (ok && scene) ok = (await scene.setTheme('halloween').catch(() => 'normal')) === 'halloween';
  if (my !== seq) {   // a newer choice took over; a load that finished late must not leave Halloween behind
    if (latest !== 'halloween') showNormalUi();
    return;
  }
  if (!ok) {
    showNormalUi();
    void scene?.setTheme('normal').catch(() => undefined);
    if (settingsStore.get().theme === 'halloween') settingsStore.set({ theme: 'normal' });
    note = 'themeFailed'; emit();
    return;
  }
  document.documentElement.dataset.theme = 'halloween';
  if (note) { note = null; emit(); }
}

/** SceneMount: the mounted scene (or null on unmount). A newly mounted scene gets the current choice. */
export function attachThemeScene(s: ThemeScene | null) {
  scene = s;
  if (s) void applyTheme(settingsStore.get().theme);
}

export const themeNote = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: () => note,
  clear() { if (note) { note = null; emit(); } },
};
export function useThemeNote() { return useSyncExternalStore(themeNote.subscribe, themeNote.get); }
