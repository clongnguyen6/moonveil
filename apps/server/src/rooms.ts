// Room registry + per-connection session state machine (unbound -> bound to one seat).
import { randomBytes, randomInt } from 'node:crypto';
import {
  type ClientMessage,
  type Mode,
  type Profile,
  ROOM_CODE_ALPHABET,
  type VoiceMode,
  ROOM_CODE_LENGTH,
  type SeatId,
} from '@moonveil/protocol';
import { type Conn, Room, type RoomDeps, RoomError, realScheduler } from './room.ts';
import type { RulesEngine } from './rules/engine.ts';
import type { RoomStore } from './store.ts';
import { nullVoiceGateway, type VoiceGateway } from './voice.ts';

export interface RegistryOptions {
  engine: () => RulesEngine<unknown>;
  voice?: VoiceGateway;
  scheduler?: RoomDeps<unknown>['scheduler'];
  now?: () => number;
  // Rooms with no connection for this long are closed.
  idleMs?: number;
  // Match seed source, called at start (tests pass a deterministic one; ctx lets tests key it per match).
  // Default: 128 random bits. Seeds decide roles: never sent to clients.
  seed?: (ctx: { hostName: string; players: number }) => string;
  // Restart recovery: rooms are saved here and restored by restoreAll().
  store?: RoomStore;
}

export class Registry {
  private rooms = new Map<string, Room>();
  private opts: RegistryOptions;

  constructor(opts: RegistryOptions) {
    this.opts = opts;
  }

  private newCode(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  private deps(): RoomDeps<unknown> {
    return {
      engine: this.opts.engine(),
      voice: this.opts.voice ?? nullVoiceGateway,
      scheduler: this.opts.scheduler ?? realScheduler,
      now: this.opts.now ?? Date.now,
      seed: this.opts.seed ?? (() => randomBytes(16).toString('hex')),
      ...(this.opts.store ? { store: this.opts.store } : {}),
    };
  }

  create(mode: Mode, creator: Profile, voiceMode: VoiceMode = 'remote'): Room {
    const code = this.newCode();
    const room = new Room(code, mode, creator, this.deps(), voiceMode);
    this.rooms.set(code, room);
    room.flush();
    return room;
  }

  // Load saved rooms after a restart. Unreadable or mismatched rooms are logged and skipped (file kept).
  restoreAll(): number {
    let n = 0;
    for (const snap of this.opts.store?.loadAll() ?? []) {
      if (this.rooms.has(snap.code)) continue;
      try {
        this.rooms.set(snap.code, Room.restore(snap, this.deps()));
        n++;
      } catch (e) {
        console.error(`room ${snap.code} not restored:`, (e as Error).message);
      }
    }
    return n;
  }

  get(code: string): Room {
    const r = this.rooms.get(code);
    if (!r || r.closed) throw new RoomError('room-not-found', 'no such room');
    return r;
  }

  sweep() {
    const now = (this.opts.now ?? Date.now)();
    const idle = this.opts.idleMs ?? 30 * 60_000;
    for (const [code, r] of this.rooms) {
      if (r.closed || (!r.hasConnections() && now - r.lastActive > idle)) {
        r.close();
        this.rooms.delete(code);
      }
    }
  }

  // Shutdown: save every open room before sockets close.
  saveAll() {
    for (const r of this.rooms.values()) if (!r.closed) r.save();
  }

  get size() {
    return this.rooms.size;
  }
}

// One per socket. Transport-agnostic so server tests can drive it without a network.
export class Session {
  private bound: { room: Room; seat: SeatId } | null = null;
  private registry: Registry;
  private conn: Conn;

  constructor(registry: Registry, conn: Conn) {
    this.registry = registry;
    this.conn = conn;
  }

  receive(msg: ClientMessage) {
    const ref = 'ref' in msg ? msg.ref : undefined;
    try {
      this.dispatch(msg);
      if (ref) this.conn.send({ t: 'ack', ref });
    } catch (e) {
      if (!(e instanceof RoomError)) throw e;
      this.conn.send({ t: 'error', code: e.code, message: e.message, ...(ref ? { ref } : {}) });
    }
  }

  private dispatch(msg: ClientMessage) {
    if (this.bound) {
      const { room, seat } = this.bound;
      if (room.closed) throw new RoomError('room-not-found', 'room closed');
      // A replaced connection may still deliver in-flight frames; drop its authority.
      if (!room.isAttached(seat, this.conn)) throw new RoomError('not-joined', 'connection replaced');
      room.handle(seat, msg);
      if (msg.t === 'leave') this.bound = null;
      return;
    }
    switch (msg.t) {
      case 'create': {
        const room = this.registry.create(msg.mode, msg.profile, msg.voiceMode);
        const seat = room.seatForToken(room.creatorToken)!;
        this.bound = { room, seat: seat.id };
        room.attach(seat, this.conn, true);
        return;
      }
      case 'join': {
        const room = this.registry.get(msg.code);
        const seat = room.join(msg.profile);
        this.bound = { room, seat: seat.id };
        room.attach(seat, this.conn, true);
        return;
      }
      case 'resume': {
        const room = this.registry.get(msg.code);
        const seat = room.seatForToken(msg.token);
        if (!seat) throw new RoomError('bad-token', 'unknown seat token');
        this.bound = { room, seat: seat.id };
        room.attach(seat, this.conn, false);
        return;
      }
      default:
        throw new RoomError('not-joined', 'create, join or resume first');
    }
  }

  closed() {
    if (this.bound) this.bound.room.detach(this.bound.seat, this.conn);
    this.bound = null;
  }
}
