// Voice seam (ADR 0004). The server is the only authority on who may speak/listen where. Once per Room.flush()
// with a changed grant map, the room calls sync(); the gateway applies provider changes (rotation, permission
// updates) BEFORE resolving and returns each seat's sessions, which the room sends to that seat only.
// Implementation: @moonveil/voice LiveKitVoiceGateway (voice owner). No provider configured = nullVoiceGateway.
import type { SeatId, VoiceGrant, VoiceSession } from '@moonveil/protocol';

export interface VoiceGateway {
  // Full current grants of every seat ([] = none). Resolves with each seat's sessions, safe to send.
  sync(room: string, grants: ReadonlyMap<SeatId, readonly VoiceGrant[]>): Promise<ReadonlyMap<SeatId, readonly VoiceSession[]>>;
  // Fresh sessions for one seat on (re)connect; current grants only.
  sessionsFor(room: string, seat: SeatId): Promise<readonly VoiceSession[]>;
  closeRoom(room: string): Promise<void>;
}

export const nullVoiceGateway: VoiceGateway = {
  sync: async (_room, grants) => new Map([...grants.keys()].map((s) => [s, []])),
  sessionsFor: async () => [],
  closeRoom: async () => {},
};

// Test helper: records the latest grants per seat and the calls; issues one fake session per listen grant.
export function recordingVoiceGateway() {
  const grants = new Map<string, readonly VoiceGrant[]>();
  const calls: { op: 'sync' | 'sessionsFor' | 'closeRoom'; room: string; seat?: SeatId }[] = [];
  const sessionsOf = (room: string, seat: SeatId): VoiceSession[] =>
    (grants.get(`${room}/${seat}`) ?? [])
      .filter((g) => g.listen)
      .map((g) => ({ channel: g.channel, url: 'wss://fake', token: `tok-${room}-${g.channel}-${seat}`, listen: g.listen, speak: g.speak }));
  const gateway: VoiceGateway = {
    async sync(room, map) {
      calls.push({ op: 'sync', room });
      for (const k of [...grants.keys()]) if (k.startsWith(`${room}/`) && !map.has(k.slice(room.length + 1))) grants.delete(k);
      for (const [seat, g] of map) grants.set(`${room}/${seat}`, g);
      return new Map([...map.keys()].map((s) => [s, sessionsOf(room, s)]));
    },
    async sessionsFor(room, seat) {
      calls.push({ op: 'sessionsFor', room, seat });
      return sessionsOf(room, seat);
    },
    async closeRoom(room) {
      calls.push({ op: 'closeRoom', room });
      for (const k of [...grants.keys()]) if (k.startsWith(`${room}/`)) grants.delete(k);
    },
  };
  return { gateway, grants, calls };
}
