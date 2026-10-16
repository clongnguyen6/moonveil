// LAN helpers (game-ui scope): copy-to-clipboard fallback on insecure origins; screen wake lock with fallback UI.
import { useEffect, useState } from 'react';

/** Returns 'copied' | 'manual' (clipboard unavailable: show the text for long-press/select) . */
export async function copyText(text: string): Promise<'copied' | 'manual'> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return 'copied';
  } catch {}
  return 'manual';
}

export type WakeState = 'unsupported' | 'off' | 'on' | 'failed';

/** Keeps the screen on while `active` (match running). Re-requests when the tab becomes visible again. */
export function useWakeLock(active: boolean): WakeState {
  const [state, setState] = useState<WakeState>(() => ('wakeLock' in navigator ? 'off' : 'unsupported'));
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const request = async () => {
      if (gone || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        setState('on');
        lock.addEventListener('release', () => !gone && setState('off'));
      } catch {
        setState('failed');
      }
    };
    void request();
    const onVis = () => void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
      setState((s) => (s === 'unsupported' ? s : 'off'));
    };
  }, [active]);
  return state;
}
