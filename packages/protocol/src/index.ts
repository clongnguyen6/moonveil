// Client/server wire protocol. One WebSocket per tab at /ws, JSON text frames.
// Client->server messages are validated with zod on the server. Server->client types are trusted.
// Server sends each connection a full per-seat snapshot (`state`); nothing else carries game data.
import type { Command, HostView } from '@moonveil/rules';
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const WS_PATH = '/ws';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const RoomCode = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-HJKMNP-Z2-9]{6}$/));

export const Mode = z.enum(['moderator', 'automatic']);
export type Mode = z.infer<typeof Mode>;

// PROVISIONAL catalog: visual scope owns the final appearance set. Ids are stable keys, not art.
export const APPEARANCE_COLORS = ['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate'] as const;
export const APPEARANCE_HATS = ['none', 'beanie', 'cap', 'bucket', 'flower', 'hood'] as const;
export const Appearance = z.strictObject({
  color: z.enum(APPEARANCE_COLORS),
  hat: z.enum(APPEARANCE_HATS),
});
export type Appearance = z.infer<typeof Appearance>;

export const NAME_MAX = 20;
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}
export const Name = z.string().max(200).transform(normalizeName).pipe(z.string().min(1).max(NAME_MAX));

export const Profile = z.strictObject({ name: Name, appearance: Appearance });
export type Profile = z.infer<typeof Profile>;

const Ref = z.string().max(32).optional();

export const CHAT_MAX = 280;
// Chat text: NFC, no control/format chars except newline, collapsed spaces, 1..CHAT_MAX.
export function normalizeChat(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cf}]|(?![\n])\p{Cc}/gu, '')
    .replace(/[^\S\n]+/gu, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const ChatText = z.string().max(2000).transform(normalizeChat).pipe(z.string().min(1).max(CHAT_MAX));
const ChannelId = z.string().min(1).max(64);
// Poses: normalized map coords (PROVISIONAL until packages/scene exports walkable bounds).
const Coord = z.number().min(0).max(1);
const Token = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);

export const ClientMessage = z.discriminatedUnion('t', [
  z.strictObject({ t: z.literal('create'), ref: Ref, mode: Mode, profile: Profile }),
  z.strictObject({ t: z.literal('join'), ref: Ref, code: RoomCode, profile: Profile }),
  z.strictObject({ t: z.literal('resume'), ref: Ref, code: RoomCode, token: Token }),
  z.strictObject({ t: z.literal('profile'), ref: Ref, profile: Profile }),
  z.strictObject({ t: z.literal('ready'), ref: Ref, ready: z.boolean() }),
  z.strictObject({ t: z.literal('start'), ref: Ref }),
  // Game action, opaque here; the rules engine validates it.
  z.strictObject({ t: z.literal('act'), ref: Ref, action: z.unknown() }),
  // Moderator mode only: close the current phase.
  z.strictObject({ t: z.literal('advance'), ref: Ref }),
  z.strictObject({ t: z.literal('leave'), ref: Ref }),
  // Text on a channel. Server accepts only with a current `speak` grant on that channel.
  z.strictObject({ t: z.literal('say'), ref: Ref, channel: ChannelId, text: ChatText }),
  // Free movement (lobby; ghosts during play). <= 10 Hz. Server silently drops moves a seat may not make. No ack.
  z.strictObject({ t: z.literal('move'), x: Coord, y: Coord, facing: z.number().min(-4).max(4), moving: z.boolean() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export type ClientMessageInput = z.input<typeof ClientMessage>;

export type SeatId = string;
export type SeatKind = 'player' | 'moderator';
export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface PublicSeat {
  seat: SeatId;
  name: string;
  appearance: Appearance;
  ready: boolean;
  // Published presence. Frozen during secret phases for non-moderators (see ADR 0001).
  connected: boolean;
}

// Voice seam: channels this seat may use now, derived server-side from game permissions.
export interface VoiceGrant {
  channel: string;
  listen: boolean;
  speak: boolean;
}

export interface SeatView {
  code: string;
  // Rules engine id: 'moonveil-werewolf' (real) or 'fixture' (tests). Selects how to read `game`.
  engine: string;
  mode: Mode;
  status: RoomStatus;
  me: { seat: SeatId; kind: SeatKind; host: boolean };
  players: PublicSeat[];
  moderator: { name: string; connected: boolean } | null;
  limits: { minPlayers: number; maxPlayers: number };
  canStart: boolean;
  // Automatic mode: server time (ms epoch) when the current phase closes. Null otherwise.
  phaseEndsAt: number | null;
  // Rules-engine projection for this viewer. Opaque to the shell.
  game: unknown;
  voice: VoiceGrant[];
}

export const ERROR_CODES = [
  'bad-message',
  'room-not-found',
  'room-full',
  'game-started',
  'name-taken',
  'bad-token',
  'not-joined',
  'already-joined',
  'not-allowed',
  'cannot-start',
  'invalid-action',
  'rate-limited',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// Real-engine game view (`SeatView.game` when engine === 'moonveil-werewolf'). Types only.
export type GameView = HostView;
// Player commands: the rules Command minus `seat` (the server supplies the actor).
type SeatCommand = Extract<Command, { seat: number }>;
export type PlayerAction = SeatCommand extends infer C ? (C extends SeatCommand ? Omit<C, 'seat'> : never) : never;
// Moderator commands (moderator mode): any rules Command; the engine authorizes.
export type ModeratorCommand = Command;
export function gameView(v: SeatView): GameView | null {
  return v.engine === 'moonveil-werewolf' && v.game ? (v.game as GameView) : null;
}

// `id` is random per message (never a room counter: gaps would leak hidden-channel activity).
export interface ChatMessage {
  id: string;
  from: SeatId;
  text: string;
  at: number;
}
export interface Pose {
  seat: SeatId;
  x: number;
  y: number;
  facing: number;
  moving: boolean;
}

export type ServerMessage =
  | { t: 'welcome'; code: string; seat: SeatId; kind: SeatKind; host: boolean; token?: string }
  // seq counts frames sent on this connection only; never a room-global counter (would leak hidden activity).
  | { t: 'state'; seq: number; view: SeatView }
  | { t: 'ack'; ref: string }
  | { t: 'error'; ref?: string; code: ErrorCode; message: string }
  | { t: 'hb' }
  | { t: 'bye'; reason: 'replaced' | 'left' | 'closed' }
  // Live chat on a channel this seat may listen to now.
  | { t: 'chat'; channel: string; msg: ChatMessage }
  // Full history of a channel, sent when the seat gains listen on it (incl. on connect). Replaces the client's log.
  // Clients show only channels with a current `listen` grant in view.voice.
  | { t: 'chatlog'; channel: string; messages: ChatMessage[] }
  // Poses of seats this seat may see moving (lobby: all; play: ghosts to ghost-listeners and moderator).
  | { t: 'poses'; poses: Pose[] }
  // Seats currently speaking on channels this seat may listen to.
  | { t: 'speaking'; seats: SeatId[] };

export const CLOSE = { protocol: 4000, replaced: 4001, left: 4002, badToken: 4003 } as const;
export const HEARTBEAT_MS = 10_000;
export const MAX_FRAME_BYTES = 16 * 1024;

export function parseClientMessage(raw: string): ClientMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = ClientMessage.safeParse(json);
  return r.success ? r.data : null;
}
