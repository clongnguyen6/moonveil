// VoiceBackend implementations: the real LiveKit RoomService client and an in-memory fake for tests.
import { RoomServiceClient } from 'livekit-server-sdk';
import type { BackendParticipant, RoomPermission, VoiceBackend } from './types.ts';

export class LiveKitBackend implements VoiceBackend {
  private readonly svc: RoomServiceClient;

  constructor(httpUrl: string, apiKey: string, apiSecret: string) {
    this.svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  }

  async listParticipants(room: string): Promise<BackendParticipant[]> {
    try {
      const list = await this.svc.listParticipants(room);
      return list.map((p) => ({
        identity: p.identity,
        permission: {
          canPublish: !!p.permission?.canPublish,
          canSubscribe: !!p.permission?.canSubscribe,
          hidden: !!p.permission?.hidden,
        },
      }));
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  async updateParticipant(room: string, identity: string, permission: RoomPermission): Promise<void> {
    await this.svc.updateParticipant(room, identity, {
      permission: {
        canPublish: permission.canPublish,
        canSubscribe: permission.canSubscribe,
        canPublishData: permission.canPublish,
        hidden: permission.hidden,
        canPublishSources: [],
      },
    });
  }

  async createRoom(room: string, emptyTimeoutSeconds: number): Promise<void> {
    await this.svc.createRoom({ name: room, emptyTimeout: emptyTimeoutSeconds });
  }

  async deleteRoom(room: string): Promise<void> {
    try {
      await this.svc.deleteRoom(room);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
  return msg.includes('not found') || msg.includes('does not exist');
}

// In-memory LiveKit stand-in. Tests "connect" participants and inspect the call log.
export interface FakeCall {
  op: 'list' | 'update' | 'create' | 'delete';
  room: string;
  identity?: string;
  permission?: RoomPermission;
}

export class FakeBackend implements VoiceBackend {
  readonly rooms = new Map<string, Map<string, RoomPermission>>(); // room -> identity -> permission
  readonly calls: FakeCall[] = [];
  // Rooms deleted so far, in order (lets tests prove the old name is gone).
  readonly deleted: string[] = [];

  // Simulate a client joining with a token's permission (as LiveKit would record it).
  connect(room: string, identity: string, permission: RoomPermission): void {
    if (!this.rooms.has(room)) throw new Error(`fake: room ${room} does not exist (auto_create off)`);
    this.rooms.get(room)!.set(identity, permission);
  }

  participants(room: string): BackendParticipant[] {
    return [...(this.rooms.get(room)?.entries() ?? [])].map(([identity, permission]) => ({ identity, permission }));
  }

  async listParticipants(room: string): Promise<BackendParticipant[]> {
    this.calls.push({ op: 'list', room });
    return this.participants(room);
  }

  async updateParticipant(room: string, identity: string, permission: RoomPermission): Promise<void> {
    this.calls.push({ op: 'update', room, identity, permission });
    const r = this.rooms.get(room);
    if (!r?.has(identity)) throw new Error(`fake: ${identity} not in ${room}`);
    r.set(identity, permission);
  }

  async createRoom(room: string): Promise<void> {
    this.calls.push({ op: 'create', room });
    if (!this.rooms.has(room)) this.rooms.set(room, new Map());
  }

  async deleteRoom(room: string): Promise<void> {
    this.calls.push({ op: 'delete', room });
    if (this.rooms.delete(room)) this.deleted.push(room);
  }
}
