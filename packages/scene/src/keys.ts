// Keyboard policy. PURE (structural DOM-like types) so it is unit-testable in node.
// Keys typed into editable elements or anything under [data-ui] never move the avatar or get preventDefault.
// Escape is never claimed by the scene, so HUD panels can always close.

export interface KeyTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function keyboardTargetIgnored(target: KeyTargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.tagName && EDITABLE_TAGS.has(target.tagName.toUpperCase())) return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('[data-ui]')) return true;
  return false;
}

export const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);
export const SPEAK_KEY = 'Space';

// Should the scene act on this keydown (track the key, and for Space claim it with preventDefault)?
export function sceneHandlesKey(code: string, target: KeyTargetLike | null | undefined): boolean {
  if (code === 'Escape') return false;
  if (!MOVE_KEYS.has(code) && code !== SPEAK_KEY) return false;
  return !keyboardTargetIgnored(target);
}

export function keysToDir(keys: ReadonlySet<string>): { x: number; y: number } {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
  const d = Math.hypot(x, y);
  if (d > 1) { x /= d; y /= d; }
  return { x, y };
}
