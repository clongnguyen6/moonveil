// Look editor draft: the chosen colour/hat previews locally (You card, list entry, own scene avatar via the scene's
// local override) and is NEVER sent until Save. Rules (approved UX):
//  - change: set the draft (override); nothing sent
//  - cancel / close / Escape: clear → saved look
//  - save: send the profile; keep the override until a server snapshot carries the same appearance, then clear;
//    rejected or no matching snapshot within SAVE_BOUND_MS → clear + notice (no phantom committed look)
//  - reconnect, seat/room change, leaving the lobby or match start while editing: discard
import type { Profile } from '@moonveil/protocol';
import { useSyncExternalStore } from 'react';

export const SAVE_BOUND_MS = () => (globalThis as { __MOONVEIL_LOOK_BOUND_MS?: number }).__MOONVEIL_LOOK_BOUND_MS ?? 6000;

export interface LookState {
  draft: Profile | null;
  /** Set on Save: the override stays until a snapshot matches, or the bound passes. */
  pendingSince: number | null;
  /** Short notice to show once when a save did not apply. */
  notice: 'notSaved' | null;
  /** Context the draft belongs to (room code + seat); any change discards it. */
  ctx: string | null;
}

let state: LookState = { draft: null, pendingSince: null, notice: null, ctx: null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export const lookDraft = {
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  get: () => state,
  /** Editor change: local preview only. */
  set(draft: Profile, ctx: string) { state = { ...state, draft, pendingSince: null, ctx }; emit(); },
  /** Cancel / close / Escape / discard: back to the saved look. */
  clear() { if (state.draft || state.pendingSince || state.ctx) { state = { draft: null, pendingSince: null, notice: state.notice, ctx: null }; emit(); } },
  /** Save sent: keep the preview until the server confirms. */
  markSaved(now = Date.now()) { if (state.draft) { state = { ...state, pendingSince: now }; emit(); } },
  /** Server snapshot carries the draft's look: done. */
  confirmed() { state = { draft: null, pendingSince: null, notice: null, ctx: null }; emit(); },
  /** Save rejected or bound passed: show the server's look and say so. */
  failed() { state = { draft: null, pendingSince: null, notice: 'notSaved', ctx: null }; emit(); },
  clearNotice() { if (state.notice) { state = { ...state, notice: null }; emit(); } },
};

export function useLookDraft(): LookState {
  return useSyncExternalStore(lookDraft.subscribe, lookDraft.get);
}
export const sameLook = (a: Profile['appearance'], b: Profile['appearance']) => a.color === b.color && a.hat === b.hat;
// Test hook (dev/e2e): read the editor state without touching React.
(globalThis as { __moonveilLook?: typeof lookDraft }).__moonveilLook = lookDraft;
