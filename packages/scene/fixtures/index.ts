// Stub server for running and testing the scene without the real server. PURE (no DOM).
// Produces SceneInput snapshots, PoseFrames filtered by viewer entitlement, and speaking lists,
// using the same rules the real server will apply (see docs/visual/INTEGRATION.md).
import { createMap, isWalkable, wanderPoint, inWorld, FIRE, WORLD, type MapLayout, type Pt } from '../src/map.ts';
import { intentFor } from '../src/choreo.ts';
import { PRESETS, randomAppearance } from '../src/appearance.ts';
import { Rng } from '../src/rng.ts';
import type { Pose, PoseFrame, SceneInput, SceneSeatState, SeatId } from '../src/types.ts';

export type FixtureScene = 'lobby' | 'seating' | 'night' | 'day' | 'ghost' | 'ended';
export const NAMES = ['Minh', 'Lan', 'Huy', 'An', 'Thảo', 'Nam', 'Quỳnh', 'Bảo', 'Linh', 'Dũng', 'Trang', 'Khoa', 'Hà', 'Phúc', 'My', 'Tùng'];

export function seatId(i: number): SeatId { return `s${i + 1}`; }

export function makeInput(scene: FixtureScene, n = 10, opts: { viewer?: SeatId | 'moderator'; dead?: SeatId[] } = {}): SceneInput {
  const players = Array.from({ length: n }, (_, i) => ({
    seat: seatId(i), name: NAMES[i] ?? `Guest ${i + 1}`, appearance: PRESETS[i] ?? randomAppearance(seatId(i)), connected: true,
  }));
  const dead = new Set(opts.dead ?? (scene === 'ghost' ? [seatId(3), seatId(7)] : []));
  const seats: SceneSeatState[] = scene === 'lobby' ? [] : players.map((p, i) => ({
    seat: p.seat, alive: !dead.has(p.seat), death: dead.has(p.seat) ? { cause: 'night', night: 1, day: i % 2 } : null,
  }));
  const me = opts.viewer === 'moderator' ? { seat: 'mod', kind: 'moderator' as const } : { seat: opts.viewer ?? (scene === 'ghost' ? seatId(3) : seatId(0)), kind: 'player' as const };
  const phase = scene === 'lobby' ? 'lobby' : scene === 'night' ? 'night' : scene === 'ended' ? 'ended' : 'day';
  const day = scene === 'seating' ? 1 : scene === 'night' ? 1 : 2;
  const reveal = scene === 'ended' ? Object.fromEntries(players.map((p, i) => [p.seat, ['Villager', 'Wolf', 'Seer', 'Guard', 'Witch', 'Hunter'][i % 6]!])) : null;
  const ghost = me.kind === 'player' && dead.has(me.seat);
  const voice = phase === 'lobby' || phase === 'ended' ? [{ channel: 'public', listen: true, speak: true }]
    : ghost ? [{ channel: 'public', listen: true, speak: false }, { channel: 'ghosts', listen: true, speak: true }]
    : phase === 'night' ? [] : [{ channel: 'public', listen: true, speak: true }];
  return { me, players, phase, day, night: scene === 'night' ? 1 : phase === 'day' && day === 2 ? 1 : 0, phaseEndsAt: null, seats, reveal, voice };
}

// Who may see whose poses. Mirrors the proposed server rule: lobby = everyone; during play, a viewer sees dead
// seats' poses only if it may listen on 'ghosts' (dead itself) or is the moderator; living seats never get frames.
export function visiblePoseSeats(input: SceneInput, all: SeatId[]): SeatId[] {
  if (input.phase === 'lobby') return all.filter((s) => input.players.some((p) => p.seat === s));
  if (input.phase === 'ended') return [];
  const dead = all.filter((s) => intentFor(input, s).kind === 'ghost');
  if (input.me.kind === 'moderator') return dead;
  const ghostListen = input.voice.some((g) => g.channel === 'ghosts' && g.listen);
  return ghostListen ? dead : [];
}

interface Mover { seat: SeatId; x: number; y: number; facing: 1 | -1; tx: number | null; ty: number | null; wait: number }

// Drives NPC movement and speaking the way a room of real players would, and emits only what the viewer may receive.
export class FakeServer {
  input: SceneInput;
  readonly map: MapLayout;
  private movers = new Map<SeatId, Mover>();
  private rng: Rng;
  private speakT = 0;
  private speaker: SeatId | null = null;
  autoSpeak = true;
  speaking = new Set<SeatId>();
  private poseAcc = 0;
  private emitPoses: ((f: PoseFrame) => void) | null = null;
  private emitSpeaking: ((s: SeatId[]) => void) | null = null;

  constructor(scene: FixtureScene, n = 10, viewer?: SeatId | 'moderator', seed = 77) {
    this.rng = new Rng(seed);
    this.map = createMap(n);
    this.input = makeInput(scene, n, { viewer });
    for (const p of this.input.players) {
      const pt = wanderPoint(this.map, this.rng, [...this.movers.values()]);
      this.movers.set(p.seat, { seat: p.seat, x: pt.x, y: pt.y, facing: 1, tx: null, ty: null, wait: this.rng.range(0, 2) });
    }
    this.placeForScene();
  }

  onPoses(cb: (f: PoseFrame) => void): void { this.emitPoses = cb; }
  onSpeaking(cb: (s: SeatId[]) => void): void { this.emitSpeaking = cb; }

  // dead: seats that are ghosts in the new scene (default: the scene's own; e.g. keep ghosts into the night)
  setScene(scene: FixtureScene, dead?: SeatId[]): void {
    const viewer = this.input.me.kind === 'moderator' ? 'moderator' : scene === 'ghost' ? undefined : this.input.me.seat;
    this.input = makeInput(scene, this.input.players.length, { viewer, ...(dead ? { dead } : {}) });
    this.placeForScene();
  }

  private placeForScene(): void {
    // ghosts start near their old seat; living players' positions are not needed during play
    for (const p of this.input.players) {
      const m = this.movers.get(p.seat)!;
      const intent = intentFor(this.input, p.seat);
      if (intent.kind === 'ghost') { const i = this.input.players.indexOf(p); m.x = FIRE.x + (i % 2 ? 260 : -260); m.y = FIRE.y + (i % 3 - 1) * 90; m.tx = m.ty = null; }
    }
  }

  // The local client's own moves (server-side validation: bounds / walkable / permission).
  move(seat: SeatId, x: number, y: number, facing: 1 | -1): boolean {
    const m = this.movers.get(seat);
    if (!m) return false;
    const intent = intentFor(this.input, seat);
    if (intent.kind === 'ghost' ? !inWorld(x, y) : intent.kind === 'free' ? !isWalkable(this.map, x, y) : true) return false;
    m.x = x; m.y = y; m.facing = facing; m.tx = m.ty = null;
    return true;
  }

  update(dt: number): void {
    const me = this.input.me.seat;
    for (const [seat, m] of this.movers) {
      if (seat === me) continue;
      const intent = intentFor(this.input, seat);
      if (intent.kind !== 'free' && intent.kind !== 'ghost') { m.tx = m.ty = null; continue; }
      const speed = intent.kind === 'ghost' ? 150 : 190;
      if (m.tx === null || m.ty === null) {
        m.wait -= dt;
        if (m.wait <= 0) {
          const t = intent.kind === 'ghost' ? { x: this.rng.range(150, WORLD.w - 150), y: this.rng.range(200, WORLD.h - 150) }
            : wanderPoint(this.map, this.rng, [...this.movers.values()].filter((o) => o !== m).map((o) => (o.tx !== null && o.ty !== null ? { x: o.tx, y: o.ty } : o)));
          m.tx = t.x; m.ty = t.y; m.wait = this.rng.range(1.5, 5);
        }
        continue;
      }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d < 4) { m.x = m.tx; m.y = m.ty; m.tx = m.ty = null; continue; }
      const step = Math.min(d, speed * dt);
      const nx = m.x + (dx / d) * step, ny = m.y + (dy / d) * step;
      if (intent.kind === 'ghost' || isWalkable(this.map, nx, ny)) { m.x = nx; m.y = ny; }
      else {
        // steer: try rotated steps, else give up on this target
        let moved = false;
        const a0 = Math.atan2(dy, dx);
        for (const da of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const tx = m.x + Math.cos(a0 + da) * step, ty = m.y + Math.sin(a0 + da) * step;
          if (isWalkable(this.map, tx, ty)) { m.x = tx; m.y = ty; moved = true; break; }
        }
        if (!moved) { m.tx = m.ty = null; }
      }
      if (Math.abs(dx) > 1) m.facing = dx > 0 ? 1 : -1;
    }
    // poses at 10 Hz, filtered
    this.poseAcc += dt;
    if (this.poseAcc >= 0.1) {
      this.poseAcc = 0;
      this.emitPoses?.(this.poseFrame());
    }
    // speaking rotation among seats the viewer may hear
    this.speakT -= dt;
    if (this.autoSpeak && this.speakT <= 0) {
      const audible = this.audibleSeats().filter((s) => s !== me);
      this.speaker = audible.length ? this.rng.pick(audible) : null;
      this.speakT = this.rng.range(2, 4.5);
      this.speaking = new Set(this.speaker ? [this.speaker] : []);
      this.emitSpeaking?.([...this.speaking]);
    } else if (!this.autoSpeak && this.speaker) { this.speaker = null; this.speaking.clear(); this.emitSpeaking?.([]); }
  }

  poseFrame(): PoseFrame {
    const allowed = new Set(visiblePoseSeats(this.input, [...this.movers.keys()]));
    const poses: Pose[] = [];
    for (const m of this.movers.values()) if (allowed.has(m.seat)) poses.push({ seat: m.seat, x: m.x, y: m.y, facing: m.facing, moving: m.tx !== null });
    return { poses };
  }

  // Seats whose speech the viewer can hear (public always during day/lobby; ghosts only via the ghosts grant).
  audibleSeats(): SeatId[] {
    const inp = this.input;
    const listens = (ch: string) => inp.me.kind === 'moderator' || inp.voice.some((g) => g.channel === ch && g.listen);
    return inp.players.filter((p) => {
      const dead = intentFor(inp, p.seat).kind === 'ghost';
      if (inp.phase === 'night') return dead ? listens('ghosts') : false;
      return dead ? listens('ghosts') : listens('public');
    }).map((p) => p.seat);
  }

  position(seat: SeatId): Pt | null { const m = this.movers.get(seat); return m ? { x: m.x, y: m.y } : null; }
}
