// Pure mapping: grants -> desired LiveKit state, and the plan to get there. No IO, fully unit-tested.
import type { SeatId } from '@moonveil/protocol';
import type { BackendParticipant, Grants, RoomPermission, VoiceGrantLike } from './types.ts';

// A grant with neither listen nor speak is no grant: the seat is not connected to that room at all.
export function isActive(g: VoiceGrantLike): boolean {
  return g.listen || g.speak;
}

// Visibility (ADR 0004 §1): explicit override, else visible iff the seat may speak in that room. Every
// listen-only session is hidden: ghosts, pending Hunter, moderator. (Defense: every living player speaks, approved 2026-10-18.)
// A speak->listen flip inside a room therefore rotates it (LiveKit cannot hide a participant in place).
// A "sticky" variant (keep visible while present) was measured in the browser suite: it left seats that
// died mid-room (execution, Hunter) visible in the public roster, which the policy forbids. Rejected.
export function visibilityOf(g: VoiceGrantLike): boolean {
  return g.visible ?? g.speak;
}

export function toPermission(g: VoiceGrantLike): RoomPermission {
  return { canPublish: g.speak, canSubscribe: g.listen, hidden: !visibilityOf(g) };
}

export function samePermission(a: RoomPermission, b: RoomPermission): boolean {
  return a.canPublish === b.canPublish && a.canSubscribe === b.canSubscribe && a.hidden === b.hidden;
}

// Room name per channel and rotation generation. Only [A-Za-z0-9_-] are used.
export function roomName(code: string, channel: string, gen: number): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${safe(code)}-${safe(channel)}-g${gen}`;
}

// Desired participants per channel: seat -> permission, for seats holding an active grant.
export function desiredByChannel(grants: Grants): Map<string, Map<SeatId, RoomPermission>> {
  const out = new Map<string, Map<SeatId, RoomPermission>>();
  for (const [seat, gs] of grants) {
    for (const g of gs) {
      if (!isActive(g)) continue;
      let m = out.get(g.channel);
      if (!m) out.set(g.channel, (m = new Map()));
      m.set(seat, toPermission(g));
    }
  }
  return out;
}

export interface ChannelPlan {
  channel: string;
  // Someone present must leave, or someone's visibility class changes: close the room, bump the
  // generation, re-issue tokens. OSS LiveKit does not revoke issued tokens, so this is the only way
  // to make old tokens useless (auto_create is off, so the old name cannot be re-joined).
  rotate: boolean;
  // Permission flips for participants that stay (publish/subscribe only; hidden flips rotate).
  updates: { identity: string; permission: RoomPermission }[];
}

export function planChannel(
  channel: string,
  desired: ReadonlyMap<SeatId, RoomPermission> | undefined,
  present: readonly BackendParticipant[],
): ChannelPlan {
  const plan: ChannelPlan = { channel, rotate: false, updates: [] };
  for (const p of present) {
    const want = desired?.get(p.identity);
    if (!want || want.hidden !== p.permission.hidden) {
      plan.rotate = true;
      plan.updates = [];
      return plan;
    }
    if (!samePermission(want, p.permission)) plan.updates.push({ identity: p.identity, permission: want });
  }
  return plan;
}

// Fisher–Yates with injectable randomness, so API call order never correlates with seat order.
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
