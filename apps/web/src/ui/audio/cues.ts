// Short synthesized UI cues (Web Audio, original, no assets). Unlocked by the first user gesture.
// Cues mark phase changes and attention; they never depend on secret state (every seat hears the same cue
// for the same public event), so audio timing reveals nothing.
import { settingsStore } from '../../game/local-store.ts';

export type Cue = 'night' | 'dawn' | 'vote' | 'attention' | 'death' | 'victory' | 'defeat' | 'tap' | 'tick';

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

function tone(c: AudioContext, at: number, f: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export function playCue(cue: Cue) {
  if (!settingsStore.get().sound) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.01;
  switch (cue) {
    case 'night': // descending, soft
      tone(c, t, 392, 0.5, 'triangle', 0.1);
      tone(c, t + 0.25, 294, 0.7, 'triangle', 0.1);
      tone(c, t + 0.5, 196, 1.2, 'sine', 0.12);
      break;
    case 'dawn': // rising chime
      tone(c, t, 523, 0.35, 'sine');
      tone(c, t + 0.15, 659, 0.35, 'sine');
      tone(c, t + 0.3, 784, 0.8, 'sine', 0.14);
      break;
    case 'vote':
      tone(c, t, 660, 0.12, 'square', 0.05);
      tone(c, t + 0.16, 880, 0.2, 'square', 0.05);
      break;
    case 'attention':
      tone(c, t, 880, 0.1, 'sine', 0.14);
      tone(c, t + 0.12, 880, 0.1, 'sine', 0.14);
      tone(c, t + 0.3, 1175, 0.4, 'sine', 0.14);
      break;
    case 'death':
      tone(c, t, 220, 1.4, 'sine', 0.12);
      tone(c, t + 0.05, 233, 1.4, 'sine', 0.06);
      break;
    case 'victory':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.13, f, 0.6, 'triangle', 0.1));
      break;
    case 'defeat':
      [392, 349, 311, 262].forEach((f, i) => tone(c, t + i * 0.22, f, 0.7, 'triangle', 0.1));
      break;
    case 'tap':
      tone(c, t, 1200, 0.05, 'sine', 0.05);
      break;
    case 'tick':
      tone(c, t, 1500, 0.04, 'square', 0.03);
      break;
  }
}
