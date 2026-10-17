// Authoritative room. Invariant: the only game data a connection receives is buildView(its seat),
// sent as a full snapshot when it differs from the last one sent to that connection.
// Secret-phase rules (ADR 0001): no frame to a seat unless its own view changed; published presence
// frozen for non-moderators; automatic mode never closes a secret phase early.
import { randomBytes } from 'node:crypto';
import {
  type Appearance,
  type ChatMessage,
  CLOSE,
  type ClientMessage,
  type ErrorCode,
  type Mode,
  type Pose,
  type VoiceMode,
  type Profile,
  type PublicSeat,
  type SeatId,
  type SeatKind,
  type SeatView,
  type ServerMessage,
  type VoiceGrant,
  type VoiceSession,
} from '@moonveil/protocol';
import { createMap, inWorld, isWalkable, type MapLayout } from '@moonveil/scene/map';
import type { PhaseInfo, RulesEngine, Viewer } from './rules/engine.ts';
import type { RoomSnapshot, RoomStore } from './store.ts';
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
  // Channels this connection currently listens to (chatlog sent on gain).
  listening: Set<string>;
  speaking: string;
  poses: string;
  // Voice: last sessions JSON sent on this connection + per-connection message counter.
  voice: string;
  voiceGen: number;
}

// Channel convention: listeners of GHOST_CHANNEL see free movement during play; its listening players may move.
export const GHOST_CHANNEL = 'ghosts';
export const CHAT_HISTORY_MAX = 500;
const CHAT_RATE = { count: 5, windowMs: 5_000 };
const MOVE_RATE = { count: 12, windowMs: 1_000 };
const POSE_TICK_MS = 100;
const SPEAKING_TICK_MS = 200;

export const EARLY_CLOSE_GRACE_MS = 1500;

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
  seed: (ctx: { hostName: string; players: number }) => string;
  store?: RoomStore;
}

type StoredSeat = Omit<Seat, 'conn'>;
interface StoredRoom {
  mode: Mode;
  voiceMode: VoiceMode;
  status: 'lobby' | 'playing' | 'ended';
  hostId: SeatId;
  players: StoredSeat[];
  moderator: StoredSeat | null;
  game: unknown;
  published: [SeatId, boolean][];
  chat: [string, ChatMessage[]][];
  lastActive: number;
  customDeck?: Record<string, number> | null;
}

export class Room<S = unknown> {
  readonly code: string;
  readonly mode: Mode;
  readonly voiceMode: VoiceMode;
  status: 'lobby' | 'playing' | 'ended' = 'lobby';
  closed = false;
  lastActive: number;

  private players: Seat[] = [];
  private moderator: Seat | null = null;
  private hostId: SeatId;
  private game: S | null = null;
  private phaseEndsAt: number | null = null;
  private phaseDurationMs: number | null = null;
  private timer: unknown = null;
  private earlyTimer: unknown = null;
  private phaseName: string | null = null;
  private published = new Map<SeatId, boolean>();
  private outbox = new Map<Conn, Outbox>();
  // Voice: JSON of the last grant map synced successfully, and a counter to drop stale async results.
  private customDeck: Record<string, number> | null = null;
  private voiceSynced = '';
  private voiceSyncSeq = 0;
  private chat = new Map<string, ChatMessage[]>();
  private sayTimes = new Map<SeatId, number[]>();
  private poses = new Map<SeatId, Pose>();
  private moveTimes = new Map<SeatId, number[]>();
  private poseTimer: unknown = null;
  private speakingOn = new Map<string, Set<SeatId>>();
  private speakingTimer: unknown = null;
  private savedJson = '';
  private deps: RoomDeps<S>;

  constructor(code: string, mode: Mode, creator: Profile, deps: RoomDeps<S>, voiceMode: VoiceMode = 'remote') {
    this.code = code;
    this.mode = mode;
    this.voiceMode = voiceMode;
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
    this.outbox.set(conn, { json: '', seq: 0, listening: new Set(), speaking: '[]', poses: '', voice: '', voiceGen: 0 });
    this.lastActive = this.deps.now();
    conn.send({
      t: 'welcome',
      code: this.code,
      seat: seat.id,
      kind: seat.kind,
      host: seat.id === this.hostId,
      ...(issueToken ? { token: seat.token } : {}),
    });
    if (this.status === 'playing') this.afterChange();
    this.flush();
    this.voiceForNewConnection(seat, conn);
  }

  detach(seatId: SeatId, conn: Conn) {
    this.outbox.delete(conn);
    const seat = this.allSeats().find((s) => s.id === seatId);
    if (seat && seat.conn === conn) {
      seat.conn = null;
      this.lastActive = this.deps.now();
      if (this.status === 'playing') this.afterChange();
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
        if (this.status !== 'playing' || this.game === null) throw new RoomError('not-allowed', 'no game');
        // Moderator mode: the moderator's commands go to engine.moderate; the engine authorizes.
        const r =
          seat.kind === 'moderator'
            ? this.deps.engine.moderate(this.game, msg.action)
            : this.deps.engine.submit(this.game, seat.id, msg.action);
        // Error goes to the actor only (Session.receive).
        if (!r.ok) throw new RoomError('invalid-action', r.code ? `${r.code}: ${r.error}` : r.error);
        this.game = r.state;
        this.afterChange();
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
      case 'deck': {
        const decks = this.deps.engine.decks;
        if (!decks || this.status !== 'lobby' || seat.id !== this.hostId) throw new RoomError('not-allowed', 'host, lobby only');
        if (msg.counts) {
          const err = decks.validate(msg.counts, this.players.length);
          if (err) throw new RoomError('invalid-action', err);
        }
        this.customDeck = msg.counts;
        break;
      }
      case 'say':
        this.say(seat, msg.channel, msg.text);
        return;
      case 'move':
        this.move(seat, msg);
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
      this.deckError() === null &&
      (this.moderator === null || this.moderator.conn !== null)
    );
  }

  private start(by: Seat) {
    if (by.id !== this.hostId) throw new RoomError('not-allowed', 'host only');
    if (!this.canStart()) throw new RoomError('cannot-start', 'need enough connected, ready players');
    this.game = this.deps.engine.setup({
      seats: this.players.map((p) => p.id),
      seed: this.deps.seed({ hostName: this.seat(this.hostId).name, players: this.players.length }),
      ...(this.customDeck ? { deck: this.customDeck } : {}),
    });
    this.status = 'playing';
    // Lobby positions end with the lobby; during play only ghosts move.
    this.poses.clear();
    this.afterChange();
  }

  private advance() {
    if (this.game === null) return;
    this.game = this.deps.engine.advance(this.game);
    this.afterChange();
  }

  // After ANY game change. Automatic mode: engine clock sync, presence pause, early close, wake-up.
  private afterChange() {
    if (this.game === null) return;
    const eng = this.deps.engine;
    const now = this.deps.now();
    if (this.mode === 'automatic') {
      this.game = eng.sync(this.game, now);
      // Approved pause rule: pause while ALL player seats are disconnected; resume when any is back.
      this.game = this.players.some((p) => p.conn !== null) ? eng.resume(this.game, now) : eng.pause(this.game, now);
    }
    const ph = eng.phase(this.game);
    if (ph.ended) this.status = 'ended';
    this.scheduleEarlyClose(ph);
    this.scheduleWake();
  }

  // Automatic mode: wake at the engine clock's deadline (none while paused) and tick.
  private scheduleWake() {
    if (this.timer !== null) this.deps.scheduler.clear(this.timer);
    this.timer = null;
    this.phaseEndsAt = null;
    this.phaseDurationMs = null;
    if (this.mode !== 'automatic' || this.game === null || this.status !== 'playing') return;
    const t = this.deps.engine.timer(this.game, this.deps.now());
    if (!t) return;
    this.phaseDurationMs = t.durationMs;
    if (t.deadline === null) return;
    this.phaseEndsAt = t.deadline;
    this.timer = this.deps.scheduler.set(Math.max(0, t.deadline - this.deps.now()), () => {
      this.timer = null;
      if (this.closed || this.game === null) return;
      // A stale wake is harmless: tick closes only an expired, running phase.
      this.game = this.deps.engine.tick(this.game, this.deps.now());
      this.afterChange();
      this.flush();
    });
  }

  // Automatic mode, public phases only: when the engine reports everyone eligible has acted,
  // close after EARLY_CLOSE_GRACE_MS (lets a last change land). Cancelled if it stops being ready.
  // Server guard: never in a secret phase, whatever the engine says.
  private scheduleEarlyClose(ph: PhaseInfo) {
    const ready = this.mode === 'automatic' && ph.earlyClose && !ph.secret && !ph.ended;
    if (!ready || this.phaseName !== ph.name) {
      if (this.earlyTimer !== null) this.deps.scheduler.clear(this.earlyTimer);
      this.earlyTimer = null;
    }
    this.phaseName = ph.name;
    if (!ready || this.earlyTimer !== null) return;
    this.earlyTimer = this.deps.scheduler.set(EARLY_CLOSE_GRACE_MS, () => {
      this.earlyTimer = null;
      const p = this.phase();
      if (this.closed || !p || !p.earlyClose || p.secret) return;
      this.advance();
      this.flush();
    });
  }

  // --- chat ---

  private rateOk(log: Map<SeatId, number[]>, seat: SeatId, rate: { count: number; windowMs: number }): boolean {
    const now = this.deps.now();
    const recent = (log.get(seat) ?? []).filter((t) => now - t < rate.windowMs);
    if (recent.length >= rate.count) {
      log.set(seat, recent);
      return false;
    }
    recent.push(now);
    log.set(seat, recent);
    return true;
  }

  // Accept only with a current speak grant; deliver to connections that listen to the channel now.
  private say(seat: Seat, channel: string, text: string) {
    if (!this.grantsFor(seat).some((g) => g.channel === channel && g.speak)) {
      throw new RoomError('not-allowed', 'cannot speak on this channel');
    }
    if (!this.rateOk(this.sayTimes, seat.id, CHAT_RATE)) throw new RoomError('rate-limited', 'too many messages');
    const msg: ChatMessage = { id: randomBytes(9).toString('base64url'), from: seat.id, name: seat.name, text, at: this.deps.now() };
    const log = this.chat.get(channel) ?? [];
    log.push(msg);
    if (log.length > CHAT_HISTORY_MAX) log.splice(0, log.length - CHAT_HISTORY_MAX);
    this.chat.set(channel, log);
    for (const s of this.allSeats()) {
      const box = s.conn ? this.outbox.get(s.conn) : undefined;
      if (s.conn && box?.listening.has(channel)) s.conn.send({ t: 'chat', channel, msg });
    }
    this.persist();
  }

  // --- movement / speaking ---

  private mayMove(seat: Seat): boolean {
    if (seat.kind !== 'player' || this.status === 'ended') return false;
    if (this.status === 'lobby') return true;
    return this.grantsFor(seat).some((g) => g.channel === GHOST_CHANNEL && g.listen);
  }

  private seesPoses(seat: Seat): boolean {
    if (this.status === 'lobby') return true;
    if (this.status !== 'playing') return false;
    return this.grantsFor(seat).some((g) => g.channel === GHOST_CHANNEL && g.listen);
  }

  private mapCache: MapLayout | null = null;
  private map(): MapLayout {
    // Same layout the renderer builds (createMap(playerCount), default seed).
    const n = this.players.length;
    if (!this.mapCache || this.mapCache.playerCount !== Math.max(4, Math.min(16, n))) this.mapCache = createMap(n);
    return this.mapCache;
  }

  private move(seat: Seat, m: { x: number; y: number; facing: 1 | -1; moving: boolean }) {
    if (!this.mayMove(seat) || !this.rateOk(this.moveTimes, seat.id, MOVE_RATE)) return;
    // Living (lobby) walk the camp; ghosts (play) drift anywhere in the world. Invalid moves are dropped.
    const ok = this.status === 'lobby' ? isWalkable(this.map(), m.x, m.y) : inWorld(m.x, m.y);
    if (!ok) return;
    this.poses.set(seat.id, { seat: seat.id, x: m.x, y: m.y, facing: m.facing, moving: m.moving });
    if (this.poseTimer === null) {
      this.poseTimer = this.deps.scheduler.set(POSE_TICK_MS, () => {
        this.poseTimer = null;
        this.flushPoses();
      });
    }
  }

  private flushPoses() {
    if (this.closed) return;
    const movers = this.allSeats().filter((s) => this.poses.has(s.id) && this.mayMove(s));
    const list = movers.map((s) => this.poses.get(s.id)!);
    const json = JSON.stringify(list);
    for (const s of this.allSeats()) {
      const box = s.conn ? this.outbox.get(s.conn) : undefined;
      if (!s.conn || !box || !this.seesPoses(s) || list.length === 0 || box.poses === json) continue;
      box.poses = json;
      s.conn.send({ t: 'poses', poses: list });
    }
  }

  // Voice adapter hook: provider-reported speaking state. Re-published per viewer, filtered by listen grants.
  setSpeaking(seatId: SeatId, channel: string, speaking: boolean) {
    const set = this.speakingOn.get(channel) ?? new Set<SeatId>();
    if (speaking) set.add(seatId);
    else set.delete(seatId);
    this.speakingOn.set(channel, set);
    if (this.speakingTimer === null) {
      this.speakingTimer = this.deps.scheduler.set(SPEAKING_TICK_MS, () => {
        this.speakingTimer = null;
        this.flush();
      });
    }
  }

  private speakingFor(listening: Set<string>): SeatId[] {
    const out = new Set<SeatId>();
    for (const ch of listening) {
      for (const id of this.speakingOn.get(ch) ?? []) {
        const sp = this.allSeats().find((x) => x.id === id);
        // Speaker must still hold a speak grant on that channel.
        if (sp && this.grantsFor(sp).some((g) => g.channel === ch && g.speak)) out.add(id);
      }
    }
    return [...out].sort();
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
    this.poses.delete(seat.id);
    // Voice: the seat is gone from the next sync's grant map, so the gateway revokes it.
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
    if (this.earlyTimer !== null) this.deps.scheduler.clear(this.earlyTimer);
    if (this.poseTimer !== null) this.deps.scheduler.clear(this.poseTimer);
    if (this.speakingTimer !== null) this.deps.scheduler.clear(this.speakingTimer);
    for (const s of this.allSeats()) {
      if (s.conn) {
        s.conn.send({ t: 'bye', reason: 'closed' });
        s.conn.close(CLOSE.left, 'closed');
        s.conn = null;
      }
    }
    this.outbox.clear();
    this.deps.voice.closeRoom(this.code).catch((e) => console.error(`voice closeRoom ${this.code}:`, e));
    this.deps.store?.remove(this.code);
  }

  // --- deck (host customization, engine-validated) ---

  private deckError(): string | null {
    const decks = this.deps.engine.decks;
    return decks && this.customDeck ? decks.validate(this.customDeck, this.players.length) : null;
  }

  private deckView(): SeatView['deck'] {
    const decks = this.deps.engine.decks;
    if (!decks || this.status !== 'lobby') return null;
    return { default: decks.default(this.players.length), custom: this.customDeck, error: this.deckError() };
  }

  // --- persistence (restart recovery) ---

  private stored(): StoredRoom {
    const strip = ({ conn: _, ...rest }: Seat): StoredSeat => rest;
    return {
      mode: this.mode,
      voiceMode: this.voiceMode,
      status: this.status,
      hostId: this.hostId,
      players: this.players.map(strip),
      moderator: this.moderator ? strip(this.moderator) : null,
      game: this.game,
      published: [...this.published],
      chat: [...this.chat],
      lastActive: this.lastActive,
      customDeck: this.customDeck,
    };
  }

  // Save when persistent state changed. Volatile state (sockets, poses, speaking, timers) is not saved.
  private persist() {
    const store = this.deps.store;
    if (!store || this.closed) return;
    const json = JSON.stringify(this.stored());
    if (json === this.savedJson) return;
    this.savedJson = json;
    const snap: RoomSnapshot = { v: 1, engine: this.deps.engine.id, code: this.code, savedAt: this.deps.now(), room: JSON.parse(json) };
    store.save(snap);
  }

  // Rebuild after a restart. Nobody is connected, so an automatic match is paused at the last save:
  // server downtime counts as paused wall time (approved pause rule); the first player back resumes it.
  static restore<S>(snap: RoomSnapshot, deps: RoomDeps<S>): Room<S> {
    if (snap.engine !== deps.engine.id) throw new Error(`room ${snap.code}: saved with engine ${snap.engine}, running ${deps.engine.id}`);
    const r = snap.room as StoredRoom;
    const room = new Room<S>(snap.code, r.mode, { name: 'restore', appearance: { color: 'moss', hat: 'none' } }, deps, r.voiceMode);
    const seat = (s: StoredSeat): Seat => ({ ...s, conn: null });
    room.players = r.players.map(seat);
    room.moderator = r.moderator ? seat(r.moderator) : null;
    room.hostId = r.hostId;
    room.status = r.status;
    room.game = r.game as S | null;
    room.published = new Map(r.published);
    room.chat = new Map(r.chat);
    room.lastActive = r.lastActive;
    room.customDeck = r.customDeck ?? null;
    room.savedJson = JSON.stringify(r);
    if (room.game !== null && room.mode === 'automatic' && room.status === 'playing') {
      room.game = deps.engine.pause(room.game, snap.savedAt);
    }
    if (room.status === 'playing') room.afterChange();
    return room;
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
      engine: engine.id,
      mode: this.mode,
      voiceMode: this.voiceMode,
      status: this.status,
      me: { seat: seat.id, kind: seat.kind, host: isHost },
      players,
      moderator: this.moderator ? { name: this.moderator.name, connected: this.moderator.conn !== null } : null,
      limits: { minPlayers: engine.minPlayers, maxPlayers: engine.maxPlayers },
      canStart: isHost && this.canStart(),
      deck: this.deckView(),
      phaseEndsAt: this.phaseEndsAt,
      phaseDurationMs: this.phaseDurationMs,
      game: this.game === null ? null : engine.view(this.game, this.viewerOf(seat)),
      voice: this.grantsFor(seat),
    };
  }

  private grantsFor(seat: Seat): VoiceGrant[] {
    if (this.game === null || this.status === 'ended') return [{ channel: 'public', listen: true, speak: true }];
    return this.deps.engine.channels(this.game, seat.kind === 'moderator' ? { kind: 'moderator' } : seat.id);
  }

  // --- voice (ADR 0004) ---

  // One gateway sync per flush whose grant map changed. Results of an older sync are dropped; a failed sync is
  // retried on the next flush. Each seat gets only its own sessions.
  private syncVoice(grants: Map<SeatId, VoiceGrant[]>) {
    const json = JSON.stringify([...grants]);
    if (json === this.voiceSynced) return;
    const n = ++this.voiceSyncSeq;
    this.deps.voice
      .sync(this.code, grants)
      .then((sessions) => {
        if (this.closed || n !== this.voiceSyncSeq) return;
        this.voiceSynced = json;
        for (const s of this.allSeats()) if (s.conn) this.sendVoice(s.conn, [...(sessions.get(s.id) ?? [])]);
      })
      .catch((e) => console.error(`voice sync ${this.code}:`, e));
  }

  private sendVoice(conn: Conn, sessions: VoiceSession[]) {
    const box = this.outbox.get(conn);
    if (!box) return;
    const json = JSON.stringify(sessions);
    if (json === box.voice) return;
    box.voice = json;
    box.voiceGen += 1;
    conn.send({ t: 'voice', gen: box.voiceGen, sessions });
  }

  // (Re)connect: fresh sessions for this seat only, on this connection only.
  private voiceForNewConnection(seat: Seat, conn: Conn) {
    this.deps.voice
      .sessionsFor(this.code, seat.id)
      .then((sessions) => {
        if (!this.closed && seat.conn === conn) this.sendVoice(conn, [...sessions]);
      })
      .catch((e) => console.error(`voice sessionsFor ${this.code}:`, e));
  }

  // Recompute and send. Call after every mutation.
  flush() {
    if (this.closed) return;
    const ph = this.phase();
    const masked = ph !== null && ph.secret && !ph.ended;
    if (!masked) for (const p of this.players) this.published.set(p.id, p.conn !== null);

    const voiceGrants = new Map<SeatId, VoiceGrant[]>();
    for (const s of this.allSeats()) {
      const g = this.grantsFor(s);
      // Voice follows the same grants, except in-person rooms: no voice at all.
      voiceGrants.set(s.id, this.voiceMode === 'inPerson' ? [] : g);
      if (!s.conn) continue;
      const box = this.outbox.get(s.conn);
      if (!box) continue;
      const view = this.buildView(s);
      const json = JSON.stringify(view);
      if (json !== box.json) {
        box.json = json;
        box.seq += 1;
        s.conn.send({ t: 'state', seq: box.seq, now: this.deps.now(), view });
      }
      // Chat history is filtered at read time: a channel's log is sent when listen is gained.
      const listening = new Set(g.filter((x) => x.listen).map((x) => x.channel));
      for (const ch of listening) {
        if (!box.listening.has(ch)) s.conn.send({ t: 'chatlog', channel: ch, messages: [...(this.chat.get(ch) ?? [])] });
      }
      box.listening = listening;
      const speaking = JSON.stringify(this.speakingFor(listening));
      if (speaking !== box.speaking) {
        box.speaking = speaking;
        s.conn.send({ t: 'speaking', seats: JSON.parse(speaking) as SeatId[] });
      }
    }
    this.syncVoice(voiceGrants);
    this.persist();
  }
}
