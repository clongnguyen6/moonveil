// Tracks how long a join has been "connecting"; past the bound it becomes 'unavailable' (voice off server-side or
// LiveKit unreachable) so the player never watches a spinner forever. Reset on leave / re-join.
import { useEffect, useRef, useState } from 'react';
import { VOICE_TIMEOUT_MS, type VoicePhase } from './phase.ts';

export function useBoundedVoice(phase: VoicePhase, joined: boolean): VoicePhase {
  const since = useRef<number | null>(null);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!joined) { since.current = null; setExpired(false); return; }
    if (phase !== 'connecting') { since.current = null; setExpired(false); return; }
    since.current ??= Date.now();
    const left = VOICE_TIMEOUT_MS() - (Date.now() - since.current);
    const id = setTimeout(() => setExpired(true), Math.max(0, left));
    return () => clearTimeout(id);
  }, [phase, joined]);
  return phase === 'connecting' && expired ? 'unavailable' : phase;
}
