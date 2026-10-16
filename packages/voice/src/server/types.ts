// Server-side types for the LiveKit adapter. Pure data; no IO here.
import type { SeatId, VoiceGrant } from '@moonveil/protocol';

// Grant as the gateway consumes it. `visible` is an optional override; when absent the adapter derives
// it (ADR 0004 §1): a seat is visible in a room iff it may speak there. Listen-only = hidden, always.
export interface VoiceGrantLike extends VoiceGrant {
  visible?: boolean;
}

// What LiveKit enforces for one participant in one room. Derived only from a grant.
export interface RoomPermission {
  canPublish: boolean;
  canSubscribe: boolean;
  hidden: boolean;
}

// A seat's handle to one channel room (ADR 0004 shape: channel, url, token, listen, speak) plus two
// extras the client uses: `room` (rotation detection without decoding the token) and `visible`.
export interface VoiceSession {
  channel: string;
  url: string; // wss:// signaling URL as seen by the client
  token: string;
  listen: boolean;
  speak: boolean;
  room: string; // LiveKit room name (includes the rotation generation)
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
