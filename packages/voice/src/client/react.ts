// React binding for VoiceClient. React is an optional peer dependency; import this file only from React code.
import { useSyncExternalStore } from 'react';
import type { VoiceClient, VoiceSnapshot } from './voice-client.ts';

export function useVoice(client: VoiceClient): VoiceSnapshot {
  return useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
}
