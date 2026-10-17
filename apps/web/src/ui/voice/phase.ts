// One readable voice phase from the VoiceClient snapshot. Joining through LiveKit Cloud takes ~10 s (mic, connect,
// publish, subscribe); a room rotation reconnects in ~2 s. Players must see "connecting" / "reconnecting", not silence.
import type { VoiceSnapshot } from '@moonveil/voice/client';

export type VoicePhase = 'off' | 'notJoined' | 'connecting' | 'reconnecting' | 'live' | 'listening' | 'denied' | 'failed';

export function voicePhase(snap: VoiceSnapshot | null, opts: { off: boolean; joined: boolean; canSpeak: boolean }): VoicePhase {
  if (opts.off) return 'off';
  if (!opts.joined) return 'notJoined';
  if (!snap) return 'connecting';
  if (snap.mic === 'denied') return 'denied';
  if (snap.mic === 'failed') return 'failed';
  const chans = Object.values(snap.channels);
  if (chans.some((c) => c.state === 'reconnecting')) return 'reconnecting';
  if (chans.some((c) => c.state === 'failed')) return 'failed';
  const connected = chans.filter((c) => c.state === 'connected');
  if (chans.length === 0 || connected.length < chans.length) return 'connecting';
  if (opts.canSpeak) {
    if (snap.mic !== 'granted' || !connected.some((c) => c.speak && c.publishing)) return 'connecting';
    return 'live';
  }
  return 'listening';
}
