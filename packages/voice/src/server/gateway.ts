// LiveKitVoiceGateway: the server's VoiceGateway adapter. Grants in, LiveKit rooms/permissions
// enforced, per-seat sessions (room + token) out. Owns rotation generations per game room.
//
// Fits the current seam (setGrants/closeRoom are sync) and carries the three proposed extensions:
// commit(room) for one batched reconcile per flush, sessions(room, seat) for token delivery, and
// the `visible` grant bit (read if present). Until commit() is wired, setGrants coalesces on a
// microtask so behaviour is still one reconcile per burst of setGrants calls.
import type { SeatId } from '@moonveil/protocol';
import { desiredByChannel, planChannel, roomName, samePermission, shuffle } from './mapping.ts';
import { mintToken, type TokenKeys } from './tokens.ts';
import type { Grants, RoomPermission, VoiceBackend, VoiceGrantLike, VoiceSession } from './types.ts';

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

  // --- VoiceGateway (current seam) ---

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

  closeRoom(room: string): void {
    const st = this.rooms.get(room);
    if (!st) return;
    this.rooms.delete(room);
    const names = [...st.gen.entries()].map(([ch, gen]) => roomName(room, ch, gen));
    void Promise.all(names.map((n) => this.opts.backend.deleteRoom(n))).catch((err) => this.opts.onError?.(room, err));
  }

  // --- proposed extensions ---

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
    const desired = desiredByChannel(grants);
    const channels = new Set<string>([...desired.keys(), ...st.gen.keys()]);
    const ops: (() => Promise<void>)[] = [];
    const rotated: string[] = [];

    for (const ch of channels) {
      const gen = st.gen.get(ch) ?? 1;
      st.gen.set(ch, gen);
      const name = roomName(room, ch, gen);
      const present = await this.opts.backend.listParticipants(name);
      const plan = planChannel(ch, desired.get(ch), present);
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
        const perm: RoomPermission = { canPublish: g.speak, canSubscribe: g.listen, hidden: !(g.visible ?? true) };
        const name = roomName(room, g.channel, st.gen.get(g.channel)!);
        const old = prev.find((s) => s.channel === g.channel);
        if (old && old.room === name && samePermission(perm, { canPublish: old.speak, canSubscribe: old.listen, hidden: !old.visible })) {
          next.push(old);
          continue;
        }
        next.push({
          channel: g.channel,
          room: name,
          url: this.opts.publicWsUrl,
          token: await mintToken(this.opts.keys, { identity: seat, room: name, permission: perm, ttlSeconds: this.opts.tokenTtlSeconds }),
          speak: g.speak,
          listen: g.listen,
          visible: g.visible ?? true,
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
