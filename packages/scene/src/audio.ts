// Procedural ambience with Web Audio: stream, fire, wind, birds (day), crickets (night).
// No audio files. Starts only after a user gesture.
export class Ambience {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fireGain!: GainNode; private streamGain!: GainNode; private windGain!: GainNode; private cricketGain!: GainNode;
  private nextBird = 0; private nextCrackle = 0; private nextChirp = 0;
  enabled = false;
  night = 0; fire = 1;

  async enable() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); this.enabled = true; this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.3); return; }
    const ctx = new AudioContext(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    const noise = this.noiseBuffer(ctx, 4);
    const src = (buf: AudioBuffer) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    // stream: bandpassed noise with slow shimmer
    this.streamGain = ctx.createGain(); this.streamGain.gain.value = 0.16;
    const sb = ctx.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1100; sb.Q.value = 0.5;
    const sl = ctx.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 3200;
    src(noise).connect(sb).connect(sl).connect(this.streamGain).connect(this.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17; const lg = ctx.createGain(); lg.gain.value = 0.04; lfo.connect(lg).connect(this.streamGain.gain); lfo.start();
    // fire bed: low rumble
    this.fireGain = ctx.createGain(); this.fireGain.gain.value = 0.2;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 260;
    src(noise).connect(fl).connect(this.fireGain).connect(this.master);
    const flfo = ctx.createOscillator(); flfo.frequency.value = 0.9; const fg = ctx.createGain(); fg.gain.value = 0.05; flfo.connect(fg).connect(this.fireGain.gain); flfo.start();
    // wind
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.05;
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 500;
    src(noise).connect(wl).connect(this.windGain).connect(this.master);
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.07; const wg = ctx.createGain(); wg.gain.value = 0.035; wlfo.connect(wg).connect(this.windGain.gain); wlfo.start();
    // cricket bed: AM sine
    this.cricketGain = ctx.createGain(); this.cricketGain.gain.value = 0;
    for (const [f, am, pan] of [[4200, 38, -0.5], [4650, 31, 0.5]] as const) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine';
      const amg = ctx.createGain(); amg.gain.value = 0;
      const amo = ctx.createOscillator(); amo.frequency.value = am; const amd = ctx.createGain(); amd.gain.value = 0.5; amo.connect(amd).connect(amg.gain);
      const chirp = ctx.createGain(); chirp.gain.value = 0.5;
      const pulse = ctx.createOscillator(); pulse.frequency.value = 1.6; pulse.type = 'square'; const pg = ctx.createGain(); pg.gain.value = 0.5; pulse.connect(pg).connect(chirp.gain);
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      o.connect(amg).connect(chirp).connect(p).connect(this.cricketGain); o.start(); amo.start(); pulse.start();
    }
    this.cricketGain.connect(this.master);
    this.enabled = true;
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
  }
  disable() { if (!this.ctx) return; this.enabled = false; this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }

  private noiseBuffer(ctx: AudioContext, sec: number) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    return buf;
  }
  private burst(freq: number, q: number, dur: number, gain: number) {
    const ctx = this.ctx!; const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(ctx, 0.2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    s.connect(f).connect(g).connect(this.master); s.start(); s.stop(ctx.currentTime + dur + 0.05);
  }
  private bird() {
    const ctx = this.ctx!; const t0 = ctx.currentTime; const n = 2 + Math.floor(Math.random() * 3); const base = 2200 + Math.random() * 1200;
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; p.connect(this.master);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine'; const g = ctx.createGain();
      const t = t0 + i * 0.16; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.06); o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.13);
      o.connect(g).connect(p); o.start(t); o.stop(t + 0.15);
    }
  }
  update(dt: number) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, now = ctx.currentTime, n = this.night;
    this.fireGain.gain.setTargetAtTime(0.08 + 0.16 * this.fire, now, 0.5);
    this.cricketGain.gain.setTargetAtTime(0.035 * n, now, 0.8);
    this.windGain.gain.setTargetAtTime(0.03 + 0.05 * n, now, 1);
    this.nextCrackle -= dt;
    if (this.nextCrackle <= 0) { this.nextCrackle = 0.08 + Math.random() * 0.5 / (0.3 + this.fire); if (Math.random() < 0.3 + 0.6 * this.fire) this.burst(2500 + Math.random() * 2500, 1.2, 0.03 + Math.random() * 0.07, 0.08 + Math.random() * 0.1); }
    this.nextBird -= dt;
    if (this.nextBird <= 0) { this.nextBird = 2 + Math.random() * 6; if (n < 0.5 && Math.random() < 1 - n * 2) this.bird(); }
    this.nextChirp -= dt;
    if (this.nextChirp <= 0) { this.nextChirp = 6 + Math.random() * 10; if (n > 0.6) this.burst(900, 6, 0.4, 0.03); }
  }
}
