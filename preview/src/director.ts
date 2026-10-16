// Phase logic for the preview: lobby wander, campfire seating, night transition to tents, dawn, ghosts.
import { Avatar } from './avatar';
import { World, FIRE, WORLD } from './world';
import { Rng, lerp, clamp, smooth } from './rng';

export type Scene = 'lobby' | 'seating' | 'night' | 'day' | 'ghost';
export type View = 'living' | 'ghost';

export interface Banner { title: string; sub: string }

export class Director {
  scene: Scene = 'lobby';
  view: View = 'living';
  night = 0;            // current lighting mix 0 day .. 1 night
  private nightTarget = 0;
  private nightSpeed = 0.25;
  ghosts = new Set<number>();
  localIndex = 0;
  autoSpeak = true;
  localSpeaking = false;
  lanternLevel: number[] = [];
  onBanner: ((b: Banner | null) => void) | null = null;
  private rng = new Rng(77);
  private timers: { t: number; fn: () => void }[] = [];
  private wanderT: number[] = [];
  private speakT = 0;
  private speaker = -1;
  private seq = 0;

  constructor(readonly avatars: Avatar[], readonly world: World) {
    this.lanternLevel = avatars.map(() => 0);
    this.wanderT = avatars.map((_, i) => i * 0.4);
    avatars.forEach((a) => { const p = world.wanderPoint(this.rng, avatars.filter((o) => o !== a)); a.setPos(p.x, p.y); });
  }

  get timerCount() { return this.timers.length; }
  private after(sec: number, fn: () => void) { this.timers.push({ t: sec, fn }); }
  private clearTimers() { this.timers.length = 0; this.seq++; }
  private banner(b: Banner | null, hideAfter = 3.2) { this.onBanner?.(b); if (b) { const s = this.seq; this.after(hideAfter, () => { if (s === this.seq) this.onBanner?.(null); }); } }

  isLocalGhost() { return this.ghosts.has(this.localIndex); }

  setScene(scene: Scene) {
    this.clearTimers();
    this.scene = scene;
    const av = this.avatars;
    if (scene !== 'ghost') { this.ghosts.clear(); this.view = 'living'; this.localIndex = 0; }
    for (const a of av) { a.alpha = 1; a.target = null; a.onArrive = null; a.speaking = false; }
    this.lanternLevel.fill(0);
    switch (scene) {
      case 'lobby':
        this.nightTarget = 0; this.nightSpeed = 0.6;
        av.forEach((a, i) => { if (a.mode !== 'walk') a.mode = 'idle'; const p = this.world.wanderPoint(this.rng, av.filter((o) => o !== a)); if (i !== this.localIndex) a.setPos(p.x, p.y); else a.setPos(FIRE.x - 40, FIRE.y + 200); this.wanderT[i] = this.rng.range(0, 2); });
        this.banner({ title: 'Lobby', sub: 'Walk around the camp while everyone arrives' }, 2.6);
        break;
      case 'seating':
        this.nightTarget = 0; this.nightSpeed = 0.6;
        av.forEach((a) => { if (a.mode === 'seated' || a.mode === 'hidden') { a.mode = 'idle'; } });
        this.banner({ title: 'Day 1', sub: 'Gather around the fire' }, 2.8);
        av.forEach((a, i) => this.sendToSeat(a, i, i * 0.1));
        break;
      case 'night':
        this.startNight();
        break;
      case 'day':
        this.startDay();
        break;
      case 'ghost':
        this.nightTarget = 0; this.nightSpeed = 0.6;
        this.ghosts = new Set([3, 7]); this.view = 'ghost'; this.localIndex = 3;
        av.forEach((a, i) => {
          if (this.ghosts.has(i)) { a.mode = 'ghost'; a.setPos(FIRE.x + (i === 3 ? -260 : 240), FIRE.y + (i === 3 ? 120 : -60)); }
          else { a.mode = 'seated'; const s = this.world.seats[i].sit; a.setPos(s.x, s.y); a.facing = s.x < FIRE.x ? 1 : -1; }
        });
        this.banner({ title: 'You are a ghost', sub: 'Drift anywhere. Only other ghosts can see you' }, 3.2);
        break;
    }
  }

  private sendToSeat(a: Avatar, i: number, delay: number) {
    const s = this.world.seats[i].sit;
    if (this.ghosts.has(i)) return;
    this.after(delay, () => a.walkTo(s.x, s.y, () => { a.mode = 'seated'; a.facing = s.x < FIRE.x ? 1 : -1; }));
  }

  private startNight() {
    const av = this.avatars;
    this.nightTarget = 1; this.nightSpeed = 0.14;
    this.banner({ title: 'Night falls', sub: 'Everyone returns to their tent' }, 4);
    av.forEach((a, i) => {
      if (this.ghosts.has(i)) return;
      if (a.mode === 'hidden') { a.mode = 'idle'; }
      a.mode = 'idle';
      const tent = this.world.tents[i];
      this.after(1.2 + i * 0.25, () => {
        a.walkTo(tent.door.x, tent.door.y, () => {
          this.lanternLevel[i] = 1;
          const s = this.seq;
          this.fade(a, 0, 0.5, () => { if (s === this.seq) a.mode = 'hidden'; });
          this.after(1.6, () => { this.lanternLevel[i] = 0.4; });
        });
      });
    });
  }

  private startDay() {
    const av = this.avatars;
    if (this.night < 0.5) this.night = 1; // scene opened directly: start from full night
    this.nightTarget = 0; this.nightSpeed = 0.14;
    this.banner({ title: 'Dawn', sub: 'Day 2 — back to the fire' }, 4);
    av.forEach((a, i) => {
      if (this.ghosts.has(i)) return;
      const tent = this.world.tents[i];
      if (a.mode === 'hidden' || this.scene === 'day') {
        a.mode = 'hidden'; a.alpha = 0; a.setPos(tent.door.x, tent.door.y);
        this.lanternLevel[i] = 0.4;
        this.after(2.5 + i * 0.3, () => { a.mode = 'idle'; this.lanternLevel[i] = 0; this.fade(a, 1, 0.5); this.sendToSeat(a, i, 0.4); });
      } else this.sendToSeat(a, i, i * 0.1);
    });
  }

  private fades: { a: Avatar; to: number; speed: number; done?: () => void }[] = [];
  private fade(a: Avatar, to: number, sec: number, done?: () => void) { this.fades = this.fades.filter((f) => f.a !== a); this.fades.push({ a, to, speed: 1 / sec, done }); }

  update(dt: number, inputDir: { x: number; y: number }) {
    // timers
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0); this.timers = this.timers.filter((t) => t.t > 0);
    for (const d of due) d.fn();
    for (const f of this.fades.slice()) {
      const a = f.a; a.alpha = a.alpha < f.to ? Math.min(f.to, a.alpha + dt * f.speed) : Math.max(f.to, a.alpha - dt * f.speed);
      if (a.alpha === f.to) { this.fades = this.fades.filter((x) => x !== f); f.done?.(); }
    }
    // lighting mix
    const d = this.nightTarget - this.night;
    this.night = Math.abs(d) < dt * this.nightSpeed ? this.nightTarget : this.night + Math.sign(d) * dt * this.nightSpeed;

    // avatars behaviour
    const av = this.avatars;
    av.forEach((a, i) => {
      const local = i === this.localIndex;
      const ghost = this.ghosts.has(i);
      if (ghost) {
        a.mode = 'ghost';
        if (!local) {
          this.wanderT[i] -= dt;
          if (!a.target && this.wanderT[i] <= 0) { a.walkTo(this.rng.range(150, WORLD.w - 150), this.rng.range(200, WORLD.h - 150)); this.wanderT[i] = this.rng.range(1, 3); }
        }
        a.speed = 150;
        a.root.visible = this.view === 'ghost';
        a.glow.visible = this.view === 'ghost';
        a.update(dt, this.labelScale, local ? inputDir : undefined, undefined);
        return;
      }
      a.speed = 190;
      a.glow.visible = false;
      if (this.scene === 'lobby' && !local) {
        this.wanderT[i] -= dt;
        if (!a.target && this.wanderT[i] <= 0) { const p = this.world.wanderPoint(this.rng, av.filter((o) => o !== a).map((o) => o.target ?? o)); a.walkTo(p.x, p.y); this.wanderT[i] = this.rng.range(1.5, 5); }
      }
      const canMove = this.scene === 'lobby' && local;
      a.update(dt, this.labelScale, canMove ? inputDir : undefined, this.world.walkable);
    });

    // speaking indicator: local via key/mic, others rotate automatically
    const localA = av[this.localIndex];
    this.speakT -= dt;
    if (this.autoSpeak && this.speakT <= 0) {
      if (this.speaker >= 0) av[this.speaker].speaking = false;
      const candidates = av.map((_, i) => i).filter((i) => i !== this.localIndex && av[i].mode !== 'hidden' && (this.view === 'ghost' ? true : !this.ghosts.has(i)));
      this.speaker = candidates.length ? this.rng.pick(candidates) : -1;
      if (this.speaker >= 0) av[this.speaker].speaking = true;
      this.speakT = this.rng.range(2, 4.5);
      if (this.rng.next() < 0.3) { const e = this.rng.pick(av.filter((_, i) => i !== this.speaker && av[i].mode !== 'hidden')); e?.showEmote(this.rng.pick(['👋', '🤔', '😄', '👍'])); }
    } else if (!this.autoSpeak && this.speaker >= 0) { av[this.speaker].speaking = false; this.speaker = -1; }
    localA.speaking = this.localSpeaking;
  }

  labelScale = 1;
  get fireIntensity() { return lerp(1, 0.45, smooth(this.night)); }
  get phaseLabel(): string {
    switch (this.scene) {
      case 'lobby': return 'Lobby';
      case 'seating': return 'Day 1';
      case 'night': return 'Night 1';
      case 'day': return 'Day 2';
      case 'ghost': return 'Day 2';
    }
  }
  get ambientColor(): number {
    // day -> dusk -> night, eased
    const n = smooth(this.night);
    const day = 0xffffff, dusk = 0xe8a070, night = 0x3a3c92;
    const c = n < 0.5 ? mix(day, dusk, n * 2) : mix(dusk, night, (n - 0.5) * 2);
    return c;
  }
  get moonLevel() { return clamp((this.night - 0.4) / 0.6, 0, 1); }
}

function mix(a: number, b: number, t: number): number {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255, br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
