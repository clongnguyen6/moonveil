// Player-facing text for server error codes. Engine validation errors (invalid-action) keep the engine's message,
// since it names the rule; everything else gets localized copy instead of the server's English string.
import type { T } from './i18n/index.ts';

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
