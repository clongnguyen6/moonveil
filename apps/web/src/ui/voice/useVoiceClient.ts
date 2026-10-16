// Snapshot of the foundation VoiceClient (one instance, created lazily by client.ts on the first non-empty voice
// message; also globalThis.__moonveil.voice). Null until it exists (in-person rooms, stub, or no voice sessions yet).
import type { VoiceClient, VoiceSnapshot } from '@moonveil/voice/client';
import { useSyncExternalStore } from 'react';
import type { Session } from '../../game/session.ts';

const EMPTY: VoiceSnapshot = { channels: {}, mic: 'idle', micError: null, muted: false, audioBlocked: false };
const noop = () => () => {};

export function useVoiceClient(session: Session): { client: VoiceClient | null; snap: VoiceSnapshot | null } {
  const client = session.voice?.() ?? null;
  const snap = useSyncExternalStore(client ? client.subscribe : noop, client ? client.getSnapshot : () => EMPTY, client ? client.getSnapshot : () => EMPTY);
  return { client, snap: client ? snap : null };
}
