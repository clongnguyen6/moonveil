// Server-side types for the LiveKit adapter. Pure data; no IO here.
import type { SeatId, VoiceGrant } from '@moonveil/protocol';

// Grant as the gateway consumes it. `visible` is the proposed protocol addition (RECOMMENDATION.md §seam 1):
// a ghost listening on public must be hidden, a living night listener must not. Default true.
export interface VoiceGrantLike extends VoiceGrant {
  visible?: boolean;
}

// What LiveKit enforces for one participant in one room. Derived only from a grant.
export interface RoomPermission {
  canPublish: boolean;
  canSubscribe: boolean;
  hidden: boolean;
}

// A seat's handle to one channel room: everything the browser needs, nothing more.
export interface VoiceSession {
  channel: string;
  room: string; // LiveKit room name (includes the rotation generation)
  url: string; // wss:// signaling URL as seen by the client
  token: string;
  speak: boolean;
  listen: boolean;
  visible: boolean;
}

// Participant as reported by the backend (ListParticipants).
export interface BackendParticipant {
  identity: string;
  permission: RoomPermission;
}

// The subset of the LiveKit server API the gateway uses. Implemented by LiveKitBackend and FakeBackend.
export interface VoiceBackend {
  // [] when the room does not exist.
  listParticipants(room: string): Promise<BackendParticipant[]>;
  // Atomic permission replacement; LiveKit removes tracks the new permission forbids.
  updateParticipant(room: string, identity: string, permission: RoomPermission): Promise<void>;
  // Idempotent. Rooms are created explicitly because auto_create is off on the server.
  createRoom(room: string, emptyTimeoutSeconds: number): Promise<void>;
  // Disconnects everyone in the room; no-op when the room does not exist.
  deleteRoom(room: string): Promise<void>;
}

export type Grants = ReadonlyMap<SeatId, readonly VoiceGrantLike[]>;
