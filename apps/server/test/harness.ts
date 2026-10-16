// In-process harness: fake connections + manual clock. Drives Registry/Session without sockets.
import type { ClientMessageInput, Profile, SeatView, ServerMessage } from '@moonveil/protocol';
import { ClientMessage } from '@moonveil/protocol';
import type { Conn, Scheduler } from '../src/room.ts';
import { Registry, Session } from '../src/rooms.ts';
import type { RulesEngine } from '../src/rules/engine.ts';
import { createFixtureEngine, type FixtureOptions } from '../src/rules/fixture-engine.ts';
import { recordingVoiceGateway } from '../src/voice.ts';

export class ManualClock implements Scheduler {
  t = 1_000_000;
  private jobs: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;
  now = () => this.t;
  set(ms: number, fn: () => void) {
    const id = this.nextId++;
    this.jobs.push({ at: this.t + ms, fn, id });
    return id;
  }
  clear(h: unknown) {
    this.jobs = this.jobs.filter((j) => j.id !== h);
  }
  tick(ms: number) {
    const end = this.t + ms;
    for (;;) {
      this.jobs.sort((a, b) => a.at - b.at);
      const j = this.jobs[0];
      if (!j || j.at > end) break;
      this.jobs.shift();
      this.t = j.at;
      j.fn();
    }
    this.t = end;
  }
}

export class FakeClient {
  frames: ServerMessage[] = [];
  closedWith: number | null = null;
  session: Session;
  token: string | undefined;
  seat: string | undefined;
  code: string | undefined;
  constructor(registry: Registry) {
    const conn: Conn = {
      send: (m) => {
        // Round-trip through JSON like the wire does.
        const msg = JSON.parse(JSON.stringify(m)) as ServerMessage;
        this.frames.push(msg);
        if (msg.t === 'welcome') {
          this.seat = msg.seat;
          this.code = msg.code;
          if (msg.token) this.token = msg.token;
        }
      },
      close: (code) => {
        if (this.closedWith === null) {
          this.closedWith = code;
          this.session.closed();
        }
      },
    };
    this.session = new Session(registry, conn);
  }
  send(m: ClientMessageInput) {
    this.session.receive(ClientMessage.parse(m));
  }
  drop() {
    this.closedWith = 1006;
    this.session.closed();
  }
  get view(): SeatView {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i]!;
      if (f.t === 'state') return f.view;
    }
    throw new Error('no state yet');
  }
  states() {
    return this.frames.filter((f) => f.t === 'state');
  }
  errors() {
    return this.frames.filter((f) => f.t === 'error');
  }
}

export const profile = (name: string, color: Profile['appearance']['color'] = 'moss'): Profile => ({
  name,
  appearance: { color, hat: 'none' },
});

export function setup(opts: { fixture?: FixtureOptions; engine?: () => RulesEngine<unknown> } = {}) {
  const clock = new ManualClock();
  const voice = recordingVoiceGateway();
  const registry = new Registry({
    engine: opts.engine ?? (() => createFixtureEngine(opts.fixture ?? { hiddenMs: 30_000, openMs: 30_000 }) as RulesEngine<unknown>),
    voice: voice.gateway,
    scheduler: clock,
    now: clock.now,
  });
  const client = () => new FakeClient(registry);

  // Creator + n-1 joiners (automatic) or moderator + n players (moderator mode), all ready.
  function room(mode: 'automatic' | 'moderator', players: number) {
    const creator = client();
    creator.send({ t: 'create', mode, profile: profile(mode === 'moderator' ? 'Mod' : 'P0') });
    const code = creator.code!;
    const list: FakeClient[] = mode === 'automatic' ? [creator] : [];
    while (list.length < players) {
      const c = client();
      c.send({ t: 'join', code, profile: profile(`P${list.length}`) });
      list.push(c);
    }
    for (const p of list) p.send({ t: 'ready', ready: true });
    return { creator, code, players: list, moderator: mode === 'moderator' ? creator : null };
  }

  return { clock, voice, registry, client, room };
}

export interface FixtureView {
  phase: string;
  me?: { secret: string; inGroup: boolean };
  group?: { key: string; members: string[]; marks: unknown[] };
  reveal?: { seat: string; secret: string; inGroup: boolean }[];
}
export const game = (c: FakeClient) => c.view.game as FixtureView;
