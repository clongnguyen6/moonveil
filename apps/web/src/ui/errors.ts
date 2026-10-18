// Player-facing text for server error codes. Engine validation errors (invalid-action) keep the engine's message,
// since it names the rule; everything else gets localized copy instead of the server's English string.
import { projection } from '../game/select.ts';
import type { SessionState } from '../game/session.ts';
import type { T } from './i18n/index.ts';

// Errors belong to the screen they arrived on (entry, lobby, or one step instance of the match): the client keeps the
// last server error until the next connect, so a lobby refusal would otherwise still show in the match dock. Root
// records each error object's screen when it first renders it; screens show an error only on that screen.
type Err = NonNullable<SessionState['error']>;
const errScreen = new WeakMap<Err, string>();
export function screenKey(s: SessionState): string {
  const v = s.view;
  if (!v) return 'entry';
  const g = projection(v);
  return `${v.code}:${v.status}:${g ? `${g.step.kind}:${g.night}:${g.day}` : ''}`;
}
/** Root only, every render: stamps a new error with the current screen. */
export function stampError(s: SessionState): void {
  if (s.error && !errScreen.has(s.error)) errScreen.set(s.error, screenKey(s));
}
/** The error to show on the current screen, or null when it belongs to another screen. */
export function screenError(s: SessionState): Err | null {
  return s.error && errScreen.get(s.error) === screenKey(s) ? s.error : null;
}

export function errorText(t: T, err: { code: string; message: string } | null): string | null {
  if (!err) return null;
  switch (err.code) {
    case 'room-not-found': return t('errRoomNotFound');
    case 'room-full': return t('errRoomFull');
    case 'game-started': return t('errGameStarted');
    case 'name-taken': return t('errNameTaken');
    case 'bad-token': return t('errBadToken');
    case 'cannot-start': return t('errCannotStart');
    case 'rate-limited': return t('errRateLimited');
    case 'network': return t('errNetwork');
    case 'not-allowed': return t('errNotAllowed');
    case 'invalid-appearance': return t('errInvalidAppearance');
    default: return err.message;
  }
}
