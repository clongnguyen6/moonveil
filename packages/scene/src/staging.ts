// Per-seat choreography on the SCENE clock: walks, fades and delayed steps for phase changes and deaths. PURE (no Pixi):
// the scene passes its avatars as `Actor`s and renders the effects through `StageHooks`; tests use fakes.
// Every pending step belongs to a seat and is dropped whenever that seat's intent changes (or on a snap), so a
// transition can never run on a seat whose state has moved on (e.g. a Hunter shot at dawn landing before the
// target's emergence timer: the target stays dead).
// Information: only the public projection (phase, alive). A living view never renders ghost poses: dead seats are
// hidden for it except a short public beat (lantern gutters + wisp at the tent; fade + wisp at the seat).
import type { AvatarMode } from './avatar.ts';
import { intentFor, type SeatIntent } from './choreo.ts';
import { FIRE, type MapLayout, type Pt } from './map.ts';
import type { SceneInput, SeatId } from './types.ts';

export interface Actor {
  mode: AvatarMode; alpha: number; x: number; y: number; facing: 1 | -1; speed: number;
  target: Pt | null; onArrive: (() => void) | null;
  setPos(x: number, y: number): void; walkTo(x: number, y: number, onArrive?: () => void): void;
}
export interface StageHooks {
  lantern(tent: number, level: number): void;    // tent lantern: 0 out, 0.4 lit inside at night, 1 bright
  wisp(at: Pt, where: 'tent' | 'seat'): void;     // public death beat effect; the scene decides how (quality, motion)
  spawn(index: number): Pt;                       // lobby spawn point for the local player
}

// timings (scene seconds)
export const T = {
  emerge: (i: number) => 2.5 + i * 0.3,   // dawn: seat i's tent opens
  emergeFade: 0.5, walkDelay: 0.4,
  toTent: (i: number) => 1.2 + i * 0.25, tentFade: 0.5, lanternSettle: 1.6,
  deathFade: 0.6, ghostFade: 0.4,
} as const;
// lantern gutter at a dead seat's tent: [delay, level]; static modes go straight to 0
const GUTTER: [number, number][] = [[0, 0.9], [0.12, 0.25], [0.25, 0.6], [0.4, 0.1], [0.55, 0]];
const LIVING_MODES: AvatarMode[] = ['idle', 'walk', 'seated'];

type Kind = SeatIntent['kind'];
interface Fade { a: Actor; to: number; speed: number; done?: () => void }

export class Staging {
  now = 0;
  private timers: { seat: SeatId; at: number; fn: () => void }[] = [];
  private fades = new Map<SeatId, Fade>();
  private dyingSeats = new Set<SeatId>();
  private intents = new Map<SeatId, Kind>();
  private dawnAt = -Infinity;   // scene time of the latest night -> day change
  private hooks: StageHooks;
  private effects: boolean;      // false on low / reduced motion: no gutter flicker (lantern straight out)

  constructor(hooks: StageHooks, effects: boolean) { this.hooks = hooks; this.effects = effects; }

  intent(seat: SeatId): Kind | undefined { return this.intents.get(seat); }
  dying(seat: SeatId): boolean { return this.dyingSeats.has(seat); }
  pending(seat?: SeatId): number { return this.timers.filter((t) => !seat || t.seat === seat).length + (seat ? (this.fades.has(seat) ? 1 : 0) : this.fades.size); }
  forget(seat: SeatId) { this.cancel(seat); this.intents.delete(seat); }

  private after(seat: SeatId, sec: number, fn: () => void) { this.timers.push({ seat, at: this.now + sec, fn }); }
  private fade(seat: SeatId, a: Actor, to: number, sec: number, done?: () => void) { this.fades.set(seat, { a, to, speed: 1 / sec, done }); }
  private cancel(seat: SeatId) {
    this.timers = this.timers.filter((t) => t.seat !== seat);
    this.fades.delete(seat); this.dyingSeats.delete(seat);
  }

  private tentBeat(i: number, map: MapLayout) {
    const tent = map.tents[i] ?? map.tents[0]!;
    if (this.effects) for (const [d, lv] of GUTTER) this.timers.push({ seat: `\u0000lantern${i}`, at: this.now + d, fn: () => this.hooks.lantern(i, lv) });
    else this.hooks.lantern(i, 0);
    this.hooks.wisp({ x: tent.x, y: tent.y - 60 }, 'tent');
  }

  // Reconcile intents with a snapshot. snapNow = place without animation (first input, remount after a reload).
  apply(prev: SceneInput, next: SceneInput, actors: ReadonlyMap<SeatId, Actor>, map: MapLayout, snapNow: boolean, hasPose: (seat: SeatId) => boolean) {
    if (!snapNow && prev.phase === 'night' && next.phase !== 'night') this.dawnAt = this.now;
    if (snapNow) { this.timers = []; this.fades.clear(); this.dyingSeats.clear(); }
    next.players.forEach((p, idx) => {
      const av = actors.get(p.seat); if (!av) return;
      const intent = intentFor(next, p.seat);
      const before = this.intents.get(p.seat);
      if (before === intent.kind && !snapNow) return;
      this.intents.set(p.seat, intent.kind);
      this.cancel(p.seat);
      av.target = null; av.onArrive = null;
      const local = p.seat === next.me.seat, seat = p.seat;
      const tent = map.tents[idx] ?? map.tents[0]!;
      switch (intent.kind) {
        case 'free': {
          av.mode = 'idle'; av.alpha = 1;
          if (local && (snapNow || before === undefined)) { const sp = this.hooks.spawn(idx); av.setPos(sp.x, sp.y); }
          if (!local) av.mode = hasPose(seat) ? 'idle' : 'hidden';
          break;
        }
        case 'seat': {
          const s = map.seats[intent.index] ?? map.seats[0]!, i = intent.index;
          const face: 1 | -1 = s.sit.x < FIRE.x ? 1 : -1;
          const sit = () => { av.mode = 'seated'; av.facing = face; };
          if (snapNow || (before === undefined) || before === 'ghost') { av.mode = 'seated'; av.alpha = 1; av.setPos(s.sit.x, s.sit.y); av.facing = face; break; }
          if (before === 'tent') {
            av.mode = 'hidden'; av.alpha = 0; av.setPos(tent.door.x, tent.door.y);
            this.after(seat, T.emerge(i), () => {
              av.mode = 'idle'; this.hooks.lantern(i, 0); this.fade(seat, av, 1, T.emergeFade);
              this.after(seat, T.walkDelay, () => av.walkTo(s.sit.x, s.sit.y, sit));
            });
          } else {
            if (av.mode === 'hidden') av.setPos(s.sit.x, s.sit.y + 160);
            av.mode = 'idle'; av.alpha = 1;
            this.after(seat, i * 0.1, () => av.walkTo(s.sit.x, s.sit.y, sit));
          }
          break;
        }
        case 'tent': {
          const i = intent.index;
          if (snapNow) { av.mode = 'hidden'; av.alpha = 0; av.setPos(tent.door.x, tent.door.y); this.hooks.lantern(i, 0.4); break; }
          av.mode = 'idle'; av.alpha = 1;
          if (before === undefined) av.setPos(map.seats[i]?.sit.x ?? FIRE.x, map.seats[i]?.sit.y ?? FIRE.y + 150);
          this.after(seat, T.toTent(i), () => av.walkTo(tent.door.x, tent.door.y, () => {
            this.hooks.lantern(i, 1);
            this.fade(seat, av, 0, T.tentFade, () => { av.mode = 'hidden'; });
            this.after(seat, T.lanternSettle, () => this.hooks.lantern(i, 0.4));
          }));
          break;
        }
        case 'ghost': {
          av.speed = 150;
          const s = map.seats[idx] ?? map.seats[0]!;
          const showGhost = () => { av.mode = 'ghost'; };
          if (snapNow || before === undefined || before === 'free' || before === 'absent') {
            this.hooks.lantern(idx, 0);
            if (local) { av.mode = 'ghost'; av.alpha = 1; av.setPos(s.sit.x, s.sit.y); } else { av.alpha = 1; av.mode = hasPose(seat) ? 'ghost' : 'hidden'; }
            break;
          }
          const inTent = before === 'tent' || (before === 'seat' && av.mode === 'hidden');
          if (inTent) {
            // died in the night (or shot at dawn before coming out): the tent stays closed; when it would have opened, a
            // public beat (lantern gutters, wisp). The victim's own ghost comes out of the tent then, in step with dawn.
            av.mode = 'hidden'; av.alpha = 0; av.setPos(tent.door.x, tent.door.y);
            const wait = before === 'tent' ? T.emerge(idx) : Math.max(0, this.dawnAt + T.emerge(idx) - this.now);
            this.after(seat, wait, () => {
              this.tentBeat(idx, map);
              if (local) { showGhost(); av.alpha = 0; this.fade(seat, av, 1, T.ghostFade); }
            });
            break;
          }
          // visible living camper (seated, walking, emerging): fade out where they are, wisp; then hidden for the living,
          // the ghost for those entitled to see ghosts (and for the player)
          this.dyingSeats.add(seat);
          if (av.mode === 'walk') av.mode = 'idle';
          this.hooks.wisp({ x: av.x, y: av.y - 40 }, 'seat');
          this.fade(seat, av, 0, T.deathFade, () => {
            this.dyingSeats.delete(seat);
            av.mode = 'hidden';
            if (local) { showGhost(); this.fade(seat, av, 1, T.ghostFade); }
            else if (hasPose(seat)) { showGhost(); av.alpha = 1; }
          });
          break;
        }
        case 'absent': av.mode = 'hidden'; break;
      }
    });
    if (snapNow && next.phase !== 'night') map.tents.forEach((_, i) => this.hooks.lantern(i, 0));
  }

  // Advance the scene clock: due steps in order, then fades.
  tick(dt: number) {
    this.now += dt;
    for (;;) {
      let k = -1;
      for (let i = 0; i < this.timers.length; i++) if (this.timers[i]!.at <= this.now && (k < 0 || this.timers[i]!.at < this.timers[k]!.at)) k = i;
      if (k < 0) break;
      const [t] = this.timers.splice(k, 1); t!.fn();
    }
    for (const [seat, f] of [...this.fades]) {
      const a = f.a;
      a.alpha = a.alpha < f.to ? Math.min(f.to, a.alpha + dt * f.speed) : Math.max(f.to, a.alpha - dt * f.speed);
      if (a.alpha === f.to && this.fades.get(seat) === f) { this.fades.delete(seat); f.done?.(); }
    }
  }
}

// a dead seat must never be drawn as a living camper (test helper + scene guard)
export const livingMode = (m: AvatarMode): boolean => LIVING_MODES.includes(m);
