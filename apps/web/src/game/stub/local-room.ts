// DEV STUB: an in-browser "server" that runs the real @moonveil/rules engine so the UI can be built and
// screenshotted before foundation wires the engine into apps/server. Mirrors Room.buildView() from
// apps/server/src/room.ts (view shape, grants, fixed phase deadlines). Never shipped to players.
import type { Mode, Profile, PublicSeat, SeatId, SeatView, VoiceGrant } from '@moonveil/protocol';
import { type Command, type DeckCounts, type HostState, type RulesEngine, createRulesEngine, defaultDeck, resolveConfig, validateDeck } from '@moonveil/rules';
import { type ConnStatus, type OutMessage, type Session, type SessionState, emptySession } from '../session.ts';
import type { ChannelId, ChatEntry } from '../types.ts';
import { pickBotAction } from './bots.ts';

export interface StubSeat {
  id: SeatId;
  kind: 'player' | 'moderator';
  name: string;
  appearance: Profile['appearance'];
  ready: boolean;
  connected: boolean;
}

export interface StubOptions {
  mode: Mode;
  code?: string;
  players?: Profile[];
  moderator?: Profile | null;
  /** 1 = real time, 0 = paused (deadlines shown, nothing advances). */
  speed?: number;
  autoBots?: boolean;
  voiceMode?: 'remote' | 'inPerson';
  seed?: string;
}

let n = 0;
const sid = () => `s_${(++n).toString(16).padStart(4, '0')}`;

export class LocalRoom implements Session {
  readonly engine: RulesEngine<HostState>;
  readonly code: string;
  readonly mode: Mode;
  players: StubSeat[] = [];
  moderator: StubSeat | null = null;
  hostId: SeatId;
  status: 'lobby' | 'playing' | 'ended' = 'lobby';
  game: HostState | null = null;
  phaseEndsAt: number | null = null;
  viewer: SeatId;
  conn: ConnStatus = 'open';
  speed: number;
  autoBots: boolean;
  voiceMode: 'remote' | 'inPerson';
  chat: ChatEntry[] = [];
  speaking: SeatId[] = [];
  error: SessionState['error'] = null;
  customDeck: Record<string, number> | null = null;
  private config = resolveConfig();
  private seed: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private cached: SessionState = emptySession();
  private dirty = true;

  constructor(opts: StubOptions) {
    this.engine = createRulesEngine();
    this.code = opts.code ?? 'STUB42';
    this.mode = opts.mode;
    this.speed = opts.speed ?? 1;
    this.autoBots = opts.autoBots ?? false;
    this.voiceMode = opts.voiceMode ?? 'remote';
    this.seed = opts.seed ?? 'moonveil-ui';
    for (const p of opts.players ?? []) this.players.push({ id: sid(), kind: 'player', ...p, ready: true, connected: true });
    if (opts.mode === 'moderator') {
      const m = opts.moderator ?? { name: 'Moderator', appearance: { color: 'slate', hat: 'none' } };
      this.moderator = { id: sid(), kind: 'moderator', ...m, ready: false, connected: true };
    }
    this.hostId = this.moderator?.id ?? this.players[0]?.id ?? '';
    this.viewer = this.hostId;
  }

  // ---- Session ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  getState = (): SessionState => {
    if (this.dirty) {
      this.cached = this.build();
      this.dirty = false;
    }
    return this.cached;
  };
  private emit() {
    this.dirty = true;
    for (const fn of this.listeners) fn();
  }

  create(mode: Mode, profile: Profile, voiceMode: 'remote' | 'inPerson' = 'remote') {
    void mode;
    this.voiceMode = voiceMode;
    const me: StubSeat = { id: sid(), kind: this.mode === 'moderator' ? 'moderator' : 'player', ...profile, ready: false, connected: true };
    if (me.kind === 'moderator') this.moderator = me;
    else this.players.unshift(me);
    this.hostId = me.id;
    this.viewer = me.id;
    this.conn = 'open';
    this.emit();
  }
  join(code: string, profile: Profile) {
    void code;
    const me: StubSeat = { id: sid(), kind: 'player', ...profile, ready: false, connected: true };
    this.players.push(me);
    this.viewer = me.id;
    this.conn = 'open';
    this.emit();
  }
  resume() {
    return true;
  }
  reclaim() {
    this.conn = 'open';
    this.emit();
  }
  leave() {
    this.conn = 'ended';
    this.emit();
  }

  send(msg: OutMessage): boolean {
    if (this.conn !== 'open') return false;
    const me = this.seat(this.viewer);
    this.error = null;
    try {
      switch (msg.t) {
        case 'ready':
          me.ready = msg.ready;
          break;
        case 'profile':
          me.name = msg.profile.name;
          me.appearance = msg.profile.appearance;
          break;
        case 'start':
          this.start();
          break;
        case 'deck': {
          if (this.status !== 'lobby' || me.id !== this.hostId) throw new Error('host, lobby only');
          if (msg.counts) {
            const err = validateDeck(msg.counts as DeckCounts, this.players.length, this.config);
            if (err) {
              this.error = { code: 'invalid-action', message: err };
              break;
            }
          }
          this.customDeck = msg.counts;
          break;
        }
        case 'act': {
          if (!this.game) throw new Error('no game');
          const r = me.kind === 'moderator' ? this.engine.moderate(this.game, msg.action) : this.engine.submit(this.game, me.id, msg.action);
          if (!r.ok) {
            this.error = { code: 'invalid-action', message: r.error };
            break;
          }
          this.game = r.state;
          if (me.kind === 'moderator') this.enterPhase();
          else this.afterChange();
          break;
        }
        case 'advance':
          if (me.kind !== 'moderator') throw new Error('moderator only');
          this.advance();
          break;
        case 'say': {
          const grants = this.grantsFor(me);
          if (!grants.some((g) => g.channel === msg.channel && g.speak)) throw new Error('cannot speak here');
          this.chat.push({ channel: msg.channel as ChannelId, msg: { id: Math.random().toString(36).slice(2), from: me.id, name: me.name, text: String(msg.text).slice(0, 500), at: Date.now() } });
          break;
        }
        case 'leave':
          this.leave();
          return true;
        default:
          break;
      }
    } catch (e) {
      this.error = { code: 'not-allowed', message: (e as Error).message };
    }
    this.emit();
    return true;
  }

  // ---- dev controls ----
  setViewer(id: SeatId) {
    this.viewer = id;
    this.emit();
  }
  simulateReconnect(ms = 1800) {
    this.conn = 'reconnecting';
    this.emit();
    setTimeout(() => {
      this.conn = 'open';
      this.emit();
    }, ms);
  }
  setSpeaking(ids: SeatId[]) {
    this.speaking = ids;
    this.emit();
  }
  /** Apply any command as the moderator actor (scenario building only). */
  drive(cmd: Command) {
    if (!this.game) throw new Error('no game');
    const r = this.engine.moderate(this.game, cmd);
    if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
    this.game = r.state;
    this.enterPhase();
    this.emit();
  }
  /** Every other player with a legal action acts at random. */
  botsAct() {
    if (!this.game) return;
    for (const p of this.players) {
      if (p.id === this.viewer) continue;
      const v = this.engine.view(this.game, { kind: 'seat', seat: p.id });
      const a = pickBotAction(v);
      if (!a) continue;
      const r = this.engine.submit(this.game, p.id, a);
      if (r.ok) this.game = r.state;
    }
    this.emit();
  }
  closeStep() {
    this.advance();
    this.emit();
  }
  allSeats(): StubSeat[] {
    return this.moderator ? [this.moderator, ...this.players] : this.players;
  }
  /** Dev bar only: role per seat id, from the full state. */
  devRoles(): Record<SeatId, string> {
    const out: Record<SeatId, string> = {};
    if (this.game) this.game.match.seats.forEach((s, i) => (out[this.game!.seatIds[i]!] = s.role));
    return out;
  }
  seedValue() {
    return this.seed;
  }

  // ---- room flow (mirrors apps/server/src/room.ts) ----
  private seat(id: SeatId): StubSeat {
    const s = this.allSeats().find((x) => x.id === id);
    if (!s) throw new Error('seat gone');
    return s;
  }
  private deckError(): string | null {
    return this.customDeck ? validateDeck(this.customDeck as DeckCounts, this.players.length, this.config) : null;
  }
  private canStart(): boolean {
    const k = this.players.length;
    return this.status === 'lobby' && k >= this.engine.minPlayers && k <= this.engine.maxPlayers && this.players.every((p) => p.ready) && this.deckError() === null;
  }
  start() {
    if (!this.canStart()) throw new Error('need enough ready players');
    const deck = this.customDeck as DeckCounts | null;
    const eng = deck ? createRulesEngine({ deck: () => deck }) : this.engine;
    this.game = eng.setup({ seats: this.players.map((p) => p.id), seed: this.seed });
    this.status = 'playing';
    this.enterPhase();
  }
  private advance() {
    if (!this.game) return;
    this.game = this.engine.advance(this.game);
    this.enterPhase();
  }
  private afterChange() {
    const ph = this.game && this.engine.phase(this.game);
    if (ph && ph.earlyClose && this.mode === 'automatic' && this.speed > 0) {
      // Server plan: short grace after everyone eligible acted (public steps only).
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.closeStep(), 1500 / this.speed);
    }
  }
  private enterPhase() {
    if (this.timer) clearTimeout(this.timer);
    if (this.botTimer) clearTimeout(this.botTimer);
    this.timer = this.botTimer = null;
    this.phaseEndsAt = null;
    if (!this.game) return;
    const ph = this.engine.phase(this.game);
    if (ph.ended) {
      this.status = 'ended';
      return;
    }
    if (this.mode === 'automatic') {
      this.phaseEndsAt = Date.now() + (this.speed > 0 ? ph.durationMs / this.speed : ph.durationMs);
      if (this.speed > 0) this.timer = setTimeout(() => this.closeStep(), ph.durationMs / this.speed);
    }
    if (this.autoBots && this.speed > 0) this.botTimer = setTimeout(() => this.botsAct(), (800 + Math.random() * 1500) / this.speed);
  }

  private grantsFor(s: StubSeat): VoiceGrant[] {
    const all: VoiceGrant[] = [{ channel: 'public', listen: true, speak: true }];
    if (!this.game || this.status === 'ended') return all;
    return this.engine.channels(this.game, s.kind === 'moderator' ? { kind: 'moderator' } : s.id);
  }

  private build(): SessionState {
    const me = this.allSeats().find((x) => x.id === this.viewer);
    if (!me || this.conn === 'ended') return { ...emptySession(), status: this.conn, error: this.error };
    const isMod = me.kind === 'moderator';
    const players: PublicSeat[] = this.players.map((p) => ({
      seat: p.id,
      name: p.name,
      appearance: p.appearance,
      ready: p.ready,
      connected: p.connected,
    }));
    const grants = this.grantsFor(me);
    const view: SeatView = {
      code: this.code,
      engine: this.engine.id,
      mode: this.mode,
      status: this.status,
      me: { seat: me.id, kind: me.kind, host: me.id === this.hostId },
      players,
      moderator: this.moderator ? { name: this.moderator.name, connected: this.moderator.connected } : null,
      limits: { minPlayers: this.engine.minPlayers, maxPlayers: this.engine.maxPlayers },
      canStart: me.id === this.hostId && this.canStart(),
      phaseEndsAt: this.phaseEndsAt,
      phaseDurationMs: this.game && this.phaseEndsAt !== null ? this.engine.phase(this.game).durationMs : null,
      voiceMode: this.voiceMode,
      deck: this.status === 'lobby' ? { default: defaultDeck(this.players.length), custom: this.customDeck, error: this.deckError() } : null,
      game: this.game ? this.engine.view(this.game, isMod ? { kind: 'moderator' } : { kind: 'seat', seat: me.id }) : null,
      voice: grants,
    };
    const listen = new Set(grants.filter((g) => g.listen).map((g) => g.channel as ChannelId));
    return {
      status: this.conn,
      code: this.code,
      view,
      error: this.error,
      chat: this.chat.filter((c) => listen.has(c.channel)), // read-time filter, as the rules API requires
      speaking: this.speaking,
      poses: [],
      voiceMode: this.voiceMode,
    };
  }
}
