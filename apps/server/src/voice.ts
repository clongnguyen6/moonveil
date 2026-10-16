// Voice seam. Provider not chosen (spikes/voice owns that). The server is the only authority on
// who may speak/listen where; a provider adapter receives grant changes and mints scoped tokens.
// Contract for adapters: never derive permissions client-side; revoke on every grant change;
// speaking indicators must be re-published by the server per seat, not read from the SFU by clients.
import type { SeatId, VoiceGrant } from '@moonveil/protocol';

export interface VoiceGateway {
  // Called with the full current grant set for a seat whenever it changes (incl. [] = revoke all).
  setGrants(room: string, seat: SeatId, grants: readonly VoiceGrant[]): void;
  // Called when a room is closed.
  closeRoom(room: string): void;
}

export const nullVoiceGateway: VoiceGateway = {
  setGrants() {},
  closeRoom() {},
};

// Test/dev helper: records the latest grants per seat.
export function recordingVoiceGateway() {
  const grants = new Map<string, readonly VoiceGrant[]>();
  const gateway: VoiceGateway = {
    setGrants(room, seat, g) {
      grants.set(`${room}/${seat}`, g);
    },
    closeRoom(room) {
      for (const k of grants.keys()) if (k.startsWith(`${room}/`)) grants.delete(k);
    },
  };
  return { gateway, grants };
}
