// Authoritative room. Invariant: the only game data a connection receives is buildView(its seat),
// sent as a full snapshot when it differs from the last one sent to that connection.
// Secret-phase rules (ADR 0001): no frame to a seat unless its own view changed; published presence
// frozen for non-moderators; automatic mode never closes a secret phase early.
import { randomBytes } from 'node:crypto';
import {
  type Appearance,
  CLOSE,
  type ClientMessage,
  type ErrorCode,
  type Mode,
  type Profile,
  type PublicSeat,
  type SeatId,
  type SeatKind,
  type SeatView,
  type ServerMessage,
  type VoiceGrant,
} from '@moonveil/protocol';
import type { PhaseInfo, RulesEngine, Viewer } from './rules/engine.ts';
import type { VoiceGateway } from './voice.ts';

export interface Conn {
  send(msg: ServerMessage): void;
  close(code: number, reason: string): void;
}

export interface Scheduler {
  set(ms: number, fn: () => void): unknown;
  clear(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  set: (ms, fn) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as NodeJS.Timeout),
};

interface Seat {
  id: SeatId;
  kind: SeatKind;
  name: string;
  appearance: Appearance;
  ready: boolean;
  token: string;
  conn: Conn | null;
}

interface Outbox {
  json: string;
  seq: number;
}

export class RoomError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const newToken = () => randomBytes(24).toString('base64url');
const newSeatId = () => `s_${randomBytes(5).toString('hex')}`;
const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

export interface RoomDeps<S> {
  engine: RulesEngine<S>;
  voice: VoiceGateway;
  scheduler: Scheduler;
  now: () => number;
  seed: () => string;
}

export class Room<S = unknown> {
  readonly code: string;
  readonly mode: Mode;
  status: 'lobby' | 'playing' | 'ended' = 'lobby';
  closed = false;
  lastActive: number;

  private players: Seat[] = [];
  private moderator: Seat | null = null;
  private hostId: SeatId;
  private game: S | null = null;
  private phaseEndsAt: number | null = null;
  private timer: unknown = null;
  private published = new Map<SeatId, boolean>();
  private outbox = new Map<Conn, Outbox>();
  private grants = new Map<SeatId, string>();
  private deps: RoomDeps<S>;

  constructor(code: string, mode: Mode, creator: Profile, deps: RoomDeps<S>) {
    this.code = code;
    this.mode = mode;
    this.deps = deps;
    this.lastActive = deps.now();
    const seat = this.makeSeat(mode === 'moderator' ? 'moderator' : 'player', creator);
    if (mode === 'moderator') this.moderator = seat;
    else this.players.push(seat);
    this.hostId = seat.id;
  }

  get creatorToken(): string {
    return (this.moderator ?? this.players[0]!).token;
  }

  private makeSeat(kind: SeatKind, p: Profile): Seat {
    return { id: newSeatId(), kind, name: p.name, appearance: p.appearance, ready: false, token: newToken(), conn: null };
  }

  private allSeats(): Seat[] {
    return this.moderator ? [this.moderator, ...this.players] : this.players;
  }

  private seat(id: SeatId): Seat {
    const s = this.allSeats().find((x) => x.id === id);
    if (!s) throw new RoomError('not-joined', 'seat gone');
    return s;
  }

  private assertNameFree(name: string, except?: SeatId) {
    if (this.allSeats().some((s) => s.id !== except && sameName(s.name, name))) {
      throw new RoomError('name-taken', 'name already used in this room');
    }
  }

  private phase(): PhaseInfo | null {
    return this.game === null ? null : this.deps.engine.phase(this.game);
  }

  // --- membership ---

  join(p: Profile): Seat {
    if (this.status !== 'lobby') throw new RoomError('game-started', 'game already started');
    if (this.players.length >= this.deps.engine.maxPlayers) throw new RoomError('room-full', 'room is full');
    this.assertNameFree(p.name);
    const seat = this.makeSeat('player', p);
    this.players.push(seat);
    return seat;
  }

  seatForToken(token: string): Seat | null {
    return this.allSeats().find((s) => s.token === token) ?? null;
  }

  // Binds a connection to a seat. A newer connection replaces an older one (reload, second tab).
  attach(seat: Seat, conn: Conn, issueToken: boolean) {
    const old = seat.conn;
    seat.conn = conn;
    if (old && old !== conn) {
      this.outbox.delete(old);
      old.send({ t: 'bye', reason: 'replaced' });
      old.close(CLOSE.replaced, 'replaced');
    }
    this.outbox.set(conn, { json: '', seq: 0 });
    this.lastActive = this.deps.now();
    conn.send({
      t: 'welcome',
      code: this.code,
      seat: seat.id,
      kind: seat.kind,
      host: seat.id === this.hostId,
      ...(issueToken ? { token: seat.token } : {}),
    });
    this.flush();
  }

  detach(seatId: SeatId, conn: Conn) {
    this.outbox.delete(conn);
    const seat = this.allSeats().find((s) => s.id === seatId);
    if (seat && seat.conn === conn) {
      seat.conn = null;
      this.lastActive = this.deps.now();
      this.flush();
    }
  }

  isAttached(seatId: SeatId, conn: Conn): boolean {
    return this.allSeats().some((s) => s.id === seatId && s.conn === conn);
  }

  hasConnections(): boolean {
    return this.allSeats().some((s) => s.conn !== null);
  }

  // --- commands ---

  handle(seatId: SeatId, msg: ClientMessage) {
    const seat = this.seat(seatId);
    this.lastActive = this.deps.now();
    switch (msg.t) {
      case 'profile':
        if (this.status !== 'lobby') throw new RoomError('not-allowed', 'profile locked during game');
        this.assertNameFree(msg.profile.name, seat.id);
        seat.name = msg.profile.name;
        seat.appearance = msg.profile.appearance;
        break;
      case 'ready':
        if (this.status !== 'lobby' || seat.kind !== 'player') throw new RoomError('not-allowed', 'not in lobby');
        seat.ready = msg.ready;
        break;
      case 'start':
        this.start(seat);
        break;
      case 'act': {
        if (this.status !== 'playing' || this.game === null || seat.kind !== 'player') {
          throw new RoomError('not-allowed', 'no game');
        }
        const r = this.deps.engine.submit(this.game, seat.id, msg.action);
        if (!r.ok) throw new RoomError('invalid-action', r.error);
        this.game = r.state;
        break;
      }
      case 'advance':
        if (this.mode !== 'moderator' || seat.kind !== 'moderator' || this.status !== 'playing') {
          throw new RoomError('not-allowed', 'moderator only');
        }
        this.advance();
        break;
      case 'leave':
        this.leave(seat);
        return;
      default:
        throw new RoomError('already-joined', 'already in a room');
    }
    this.flush();
  }

  private canStart(): boolean {
    const n = this.players.length;
    const { minPlayers, maxPlayers } = this.deps.engine;
    return (
      this.status === 'lobby' &&
      n >= minPlayers &&
      n <= maxPlayers &&
      this.players.every((p) => p.ready && p.conn !== null) &&
      (this.moderator === null || this.moderator.conn !== null)
    );
  }

  private start(by: Seat) {
    if (by.id !== this.hostId) throw new RoomError('not-allowed', 'host only');
    if (!this.canStart()) throw new RoomError('cannot-start', 'need enough connected, ready players');
    this.game = this.deps.engine.setup({ seats: this.players.map((p) => p.id), seed: this.deps.seed() });
    this.status = 'playing';
    this.enterPhase();
  }

  private advance() {
    if (this.game === null) return;
    this.game = this.deps.engine.advance(this.game);
    this.enterPhase();
  }

  private enterPhase() {
    if (this.timer !== null) this.deps.scheduler.clear(this.timer);
    this.timer = null;
    this.phaseEndsAt = null;
    const ph = this.phase();
    if (!ph) return;
    if (ph.ended) {
      this.status = 'ended';
      return;
    }
    if (this.mode === 'automatic') {
      // Fixed deadline, no early close: phase length must not depend on hidden actions.
      this.phaseEndsAt = this.deps.now() + ph.durationMs;
      this.timer = this.deps.scheduler.set(ph.durationMs, () => {
        this.timer = null;
        if (this.closed) return;
        this.advance();
        this.flush();
      });
    }
  }

  private leave(seat: Seat) {
    if (this.status === 'playing') throw new RoomError('not-allowed', 'cannot leave a running game');
    const conn = seat.conn;
    if (seat.kind === 'moderator') {
      this.close();
      return;
    }
    this.players = this.players.filter((p) => p !== seat);
    this.published.delete(seat.id);
    this.grants.delete(seat.id);
    this.deps.voice.setGrants(this.code, seat.id, []);
    if (conn) {
      this.outbox.delete(conn);
      conn.send({ t: 'bye', reason: 'left' });
      conn.close(CLOSE.left, 'left');
    }
    if (seat.id === this.hostId) {
      const next = this.players[0];
      if (!next) {
        this.close();
        return;
      }
      this.hostId = next.id;
      // host flag lives in welcome + view.me; view.me updates via flush.
    }
    this.flush();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.timer !== null) this.deps.scheduler.clear(this.timer);
    for (const s of this.allSeats()) {
      if (s.conn) {
        s.conn.send({ t: 'bye', reason: 'closed' });
        s.conn.close(CLOSE.left, 'closed');
        s.conn = null;
      }
    }
    this.outbox.clear();
    this.deps.voice.closeRoom(this.code);
  }

  // --- projection ---

  private viewerOf(seat: Seat): Viewer {
    return seat.kind === 'moderator' ? { kind: 'moderator' } : { kind: 'seat', seat: seat.id };
  }

  buildView(seat: Seat): SeatView {
    const isMod = seat.kind === 'moderator';
    const players: PublicSeat[] = this.players.map((p) => ({
      seat: p.id,
      name: p.name,
      appearance: p.appearance,
      ready: p.ready,
      connected: isMod || p.id === seat.id ? p.conn !== null : (this.published.get(p.id) ?? false),
    }));
    const isHost = seat.id === this.hostId;
    const engine = this.deps.engine;
    return {
      code: this.code,
      mode: this.mode,
      status: this.status,
      me: { seat: seat.id, kind: seat.kind, host: isHost },
      players,
      moderator: this.moderator ? { name: this.moderator.name, connected: this.moderator.conn !== null } : null,
      limits: { minPlayers: engine.minPlayers, maxPlayers: engine.maxPlayers },
      canStart: isHost && this.canStart(),
      phaseEndsAt: this.phaseEndsAt,
      game: this.game === null ? null : engine.view(this.game, this.viewerOf(seat)),
      voice: this.grantsFor(seat),
    };
  }

  private grantsFor(seat: Seat): VoiceGrant[] {
    const all: VoiceGrant[] = [{ channel: 'public', listen: true, speak: true }];
    if (this.game === null || this.status === 'ended' || seat.kind === 'moderator') return all;
    return this.deps.engine.channels(this.game, seat.id);
  }

  // Recompute and send. Call after every mutation.
  flush() {
    if (this.closed) return;
    const ph = this.phase();
    const masked = ph !== null && ph.secret && !ph.ended;
    if (!masked) for (const p of this.players) this.published.set(p.id, p.conn !== null);

    for (const s of this.allSeats()) {
      const g = this.grantsFor(s);
      const gj = JSON.stringify(g);
      if (this.grants.get(s.id) !== gj) {
        this.grants.set(s.id, gj);
        this.deps.voice.setGrants(this.code, s.id, g);
      }
      if (!s.conn) continue;
      const box = this.outbox.get(s.conn);
      if (!box) continue;
      const view = this.buildView(s);
      const json = JSON.stringify(view);
      if (json === box.json) continue;
      box.json = json;
      box.seq += 1;
      s.conn.send({ t: 'state', seq: box.seq, view });
    }
  }
}
