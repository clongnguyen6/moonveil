// Local microphone check and mute state. The voice provider adapter (voice scope) will consume the stream;
// here we only prove capture works and show a level meter. Denied/failed states lead to text play.
import { useCallback, useEffect, useRef, useState } from 'react';

export type MicStatus = 'idle' | 'checking' | 'ok' | 'denied' | 'unsupported' | 'insecure' | 'error';

export interface Mic {
  status: MicStatus;
  level: number; // 0..1
  muted: boolean;
  textOnly: boolean;
  check(): Promise<void>;
  setMuted(m: boolean): void;
  setTextOnly(t: boolean): void;
  stop(): void;
}

export function useMic(): Mic {
  const [status, setStatus] = useState<MicStatus>(() => {
    if (!window.isSecureContext) return 'insecure';
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    return 'idle';
  });
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const audio = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audio.current?.ctx.close();
    audio.current = null;
    setLevel(0);
  }, []);

  const check = useCallback(async () => {
    if (!window.isSecureContext) return setStatus('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported');
    setStatus('checking');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      audio.current = { ctx, analyser };
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        raf.current = requestAnimationFrame(loop);
      };
      loop();
      setStatus('ok');
      setTextOnly(false);
    } catch (e) {
      const name = (e as DOMException).name;
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => {
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  return { status, level, muted, textOnly, check, setMuted, setTextOnly, stop };
}
