// LiveKitVoiceGateway: the server's VoiceGateway adapter (seam per docs/architecture/0004-voice-seam.md):
//   sync(room, grants)        one call per Room.flush() with every seat's full grants; applies LiveKit
//                             changes (UpdateParticipant, rotation, DeleteRoom) before resolving; returns
//                             each seat's sessions (tokens) for the server's `voice` message
//   sessionsFor(room, seat)   fresh sessions for one seat on (re)connect
//   closeRoom(room)           deletes every channel room of that game
// Owns rotation generations per game room. setGrants/commit remain as helpers for tests and for the
// older per-seat seam.
import type { SeatId } from '@moonveil/protocol';
import { desiredByChannel, planChannel, roomName, samePermission, shuffle } from './mapping.ts';
import { mintToken, type TokenKeys } from './tokens.ts';
import type { BackendParticipant, Grants, RoomPermission, VoiceBackend, VoiceGrantLike, VoiceSession } from './types.ts';

export interface LiveKitVoiceGatewayOptions {
  backend: VoiceBackend;
  keys: TokenKeys;
  // wss:// URL the browser uses. Fixed configuration, never derived from request headers in production.
  publicWsUrl: string;
  tokenTtlSeconds?: number; // default 15 min; LiveKit refreshes tokens of connected participants itself
  roomEmptyTimeoutSeconds?: number; // default 10 min
  // Called after a commit for every seat whose sessions changed (new tokens or revoked channels).
  onSessions?: (room: string, seat: SeatId, sessions: VoiceSession[]) => void;
  onError?: (room: string, err: unknown) => void;
  // false = reconcile only on explicit commit(room). Default true = also coalesce on a microtask.
  autoCommit?: boolean;
  random?: () => number;
}

interface RoomState {
  grants: Map<SeatId, readonly VoiceGrantLike[]>;
  gen: Map<string, number>; // channel -> generation
  sessions: Map<SeatId, VoiceSession[]>;
  dirty: boolean;
  committing: Promise<void> | null;
  scheduled: boolean;
}

export class LiveKitVoiceGateway {
  private readonly rooms = new Map<string, RoomState>();
  private readonly opts: Required<Pick<LiveKitVoiceGatewayOptions, 'tokenTtlSeconds' | 'roomEmptyTimeoutSeconds' | 'autoCommit' | 'random'>> &
    LiveKitVoiceGatewayOptions;

  constructor(opts: LiveKitVoiceGatewayOptions) {
    this.opts = { tokenTtlSeconds: 15 * 60, roomEmptyTimeoutSeconds: 10 * 60, autoCommit: true, random: Math.random, ...opts };
  }

  // --- VoiceGateway (ADR 0004) ---

  // Replace every seat's grants for this game room and reconcile LiveKit. Seats missing from the map
  // hold no grants. Resolves after LiveKit is updated; the returned sessions are safe to send.
  async sync(room: string, grants: ReadonlyMap<SeatId, readonly VoiceGrantLike[]>): Promise<ReadonlyMap<SeatId, readonly VoiceSession[]>> {
    const st = this.state(room);
    const seats = new Set<SeatId>([...st.grants.keys(), ...grants.keys()]);
    for (const seat of seats) this.setGrants(room, seat, grants.get(seat) ?? []);
    await this.commit(room);
    const out = new Map<SeatId, readonly VoiceSession[]>();
    for (const seat of grants.keys()) out.set(seat, st.sessions.get(seat) ?? []);
    return out;
  }

  async sessionsFor(room: string, seat: SeatId): Promise<readonly VoiceSession[]> {
    return this.sessions(room, seat);
  }

  async closeRoom(room: string): Promise<void> {
    const st = this.rooms.get(room);
    if (!st) return;
    this.rooms.delete(room);
    const names = [...st.gen.entries()].map(([ch, gen]) => roomName(room, ch, gen));
    try {
      await Promise.all(names.map((n) => this.opts.backend.deleteRoom(n)));
    } catch (err) {
      this.opts.onError?.(room, err);
    }
  }

  // --- per-seat helpers (older seam; tests) ---

  setGrants(room: string, seat: SeatId, grants: readonly VoiceGrantLike[]): void {
    const st = this.state(room);
    const active = grants.filter((g) => g.listen || g.speak);
    if (active.length === 0) st.grants.delete(seat);
    else st.grants.set(seat, active);
    st.dirty = true;
    if (this.opts.autoCommit && !st.scheduled) {
      st.scheduled = true;
      queueMicrotask(() => {
        st.scheduled = false;
        void this.commit(room);
      });
    }
  }

  // Reconcile LiveKit with the current grants of one game room. Serialized per room; a call made
  // while a commit runs waits for it and then reconciles again if anything changed meanwhile.
  commit(room: string): Promise<void> {
    const st = this.state(room);
    if (st.committing) return st.committing.then(() => (st.dirty ? this.commit(room) : undefined));
    if (!st.dirty) return Promise.resolve();
    st.dirty = false;
    st.committing = this.reconcile(room, st)
      .catch((err) => this.opts.onError?.(room, err))
      .finally(() => {
        st.committing = null;
      });
    return st.committing;
  }

  // Current sessions for a seat (after the last commit). Empty when the seat holds no grant.
  async sessions(room: string, seat: SeatId): Promise<VoiceSession[]> {
    const st = this.rooms.get(room);
    if (!st) return [];
    if (st.committing) await st.committing;
    return st.sessions.get(seat) ?? [];
  }

  // Current LiveKit room name of a channel (tests/diagnostics).
  roomNameOf(room: string, channel: string): string {
    const st = this.state(room);
    return roomName(room, channel, st.gen.get(channel) ?? 1);
  }

  // --- internals ---

  private state(room: string): RoomState {
    let st = this.rooms.get(room);
    if (!st) this.rooms.set(room, (st = { grants: new Map(), gen: new Map(), sessions: new Map(), dirty: false, committing: null, scheduled: false }));
    return st;
  }

  private async reconcile(room: string, st: RoomState): Promise<void> {
    const grants: Grants = st.grants;
    const channels = new Set<string>([...st.gen.keys()]);
    for (const gs of grants.values()) for (const g of gs) if (g.listen || g.speak) channels.add(g.channel);
    const present = new Map<string, readonly BackendParticipant[]>();
    for (const ch of channels) {
      const gen = st.gen.get(ch) ?? 1;
      st.gen.set(ch, gen);
      present.set(ch, await this.opts.backend.listParticipants(roomName(room, ch, gen)));
    }
    const desired = desiredByChannel(grants, present);
    const ops: (() => Promise<void>)[] = [];
    const rotated: string[] = [];

    for (const ch of channels) {
      const gen = st.gen.get(ch)!;
      const name = roomName(room, ch, gen);
      const plan = planChannel(ch, desired.get(ch), present.get(ch) ?? []);
      if (plan.rotate) {
        ops.push(() => this.opts.backend.deleteRoom(name));
        st.gen.set(ch, gen + 1);
        rotated.push(ch);
        continue;
      }
      for (const u of plan.updates) ops.push(() => this.opts.backend.updateParticipant(name, u.identity, u.permission));
    }
    // Parallel, shuffled: observable timing must not correlate with seat order or role.
    await Promise.all(shuffle(ops, this.opts.random).map((f) => f()));
    // Rooms exist before any token for them is handed out (auto_create is off).
    await Promise.all([...desired.keys()].map((ch) => this.opts.backend.createRoom(roomName(room, ch, st.gen.get(ch)!), this.opts.roomEmptyTimeoutSeconds)));

    // Sessions: re-mint where the room name or permission changed; drop channels no longer granted.
    const seats = new Set<SeatId>([...grants.keys(), ...st.sessions.keys()]);
    for (const seat of seats) {
      const prev = st.sessions.get(seat) ?? [];
      const next: VoiceSession[] = [];
      for (const g of grants.get(seat) ?? []) {
        const perm: RoomPermission = desired.get(g.channel)?.get(seat) ?? { canPublish: g.speak, canSubscribe: g.listen, hidden: !g.speak };
        const name = roomName(room, g.channel, st.gen.get(g.channel)!);
        const old = prev.find((s) => s.channel === g.channel);
        if (old && old.room === name && samePermission(perm, { canPublish: old.speak, canSubscribe: old.listen, hidden: !old.visible })) {
          next.push(old);
          continue;
        }
        next.push({
          channel: g.channel,
          url: this.opts.publicWsUrl,
          token: await mintToken(this.opts.keys, { identity: seat, room: name, permission: perm, ttlSeconds: this.opts.tokenTtlSeconds }),
          listen: g.listen,
          speak: g.speak,
          room: name,
          visible: !perm.hidden,
        });
      }
      const changed = next.length !== prev.length || next.some((s, i) => s !== prev[i]);
      if (next.length === 0) st.sessions.delete(seat);
      else st.sessions.set(seat, next);
      if (changed) this.opts.onSessions?.(room, seat, next);
    }
    void rotated;
  }
}
