// Pure mapping: grants -> desired LiveKit state, and the plan to get there. No IO, fully unit-tested.
import type { SeatId } from '@moonveil/protocol';
import type { BackendParticipant, Grants, RoomPermission, VoiceGrantLike } from './types.ts';

// A grant with neither listen nor speak is no grant: the seat is not connected to that room at all.
export function isActive(g: VoiceGrantLike): boolean {
  return g.listen || g.speak;
}

// Visibility: explicit override, else derived from speak (ADR 0004). `sticky` is the seat's current
// visibility in this room generation, if it is already present there: a seat that entered visible stays
// visible while it stays in the room (defense: other living players keep listening, visible, no rotation).
export function visibilityOf(g: VoiceGrantLike, sticky?: boolean): boolean {
  if (g.visible !== undefined) return g.visible;
  if (g.speak) return true;
  return sticky ?? false;
}

export function toPermission(g: VoiceGrantLike, sticky?: boolean): RoomPermission {
  return { canPublish: g.speak, canSubscribe: g.listen, hidden: !visibilityOf(g, sticky) };
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
// `present` (channel -> participants currently in that room) supplies the sticky visibility.
export function desiredByChannel(grants: Grants, present?: ReadonlyMap<string, readonly BackendParticipant[]>): Map<string, Map<SeatId, RoomPermission>> {
  const out = new Map<string, Map<SeatId, RoomPermission>>();
  for (const [seat, gs] of grants) {
    for (const g of gs) {
      if (!isActive(g)) continue;
      let m = out.get(g.channel);
      if (!m) out.set(g.channel, (m = new Map()));
      const cur = present?.get(g.channel)?.find((p) => p.identity === seat);
      m.set(seat, toPermission(g, cur ? !cur.permission.hidden : undefined));
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
