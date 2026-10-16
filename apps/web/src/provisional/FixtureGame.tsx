// PROVISIONAL: renders the server's FIXTURE engine view so the shell and e2e can exercise a game loop.
// Not Moonveil gameplay or visuals. Replace when packages/rules and the renderer land.
import type { ClientMessageInput, SeatView } from '@moonveil/protocol';

interface FixtureView {
  engine: 'fixture';
  phase: 'hidden' | 'open' | 'ended';
  round: number;
  me?: { secret: string; inGroup: boolean };
  group?: { key: string; members: string[]; marks: { by: string; target: string }[] };
  reveal?: { seat: string; secret: string; inGroup: boolean }[];
}

export function FixtureGame({ view, send }: { view: SeatView; send: (m: ClientMessageInput) => boolean }) {
  const g = view.game as FixtureView | null;
  if (!g || g.engine !== 'fixture') return null;
  const name = (seat: string) => view.players.find((p) => p.seat === seat)?.name ?? seat;
  const ends = view.phaseEndsAt ? Math.max(0, Math.round((view.phaseEndsAt - Date.now()) / 1000)) : null;
  return (
    <div className="card game" data-testid="game" data-phase={g.phase}>
      <p className="provisional">Provisional test engine — not the real rules.</p>
      <p>
        Phase <strong data-testid="phase">{g.phase}</strong> · round {g.round}
        {ends !== null && ` · ~${ends}s`}
      </p>
      {g.me && (
        <p>
          Your secret: <code data-testid="my-secret">{g.me.secret}</code>
          {g.me.inGroup && ' · you are in the hidden group'}
        </p>
      )}
      {g.group && (
        <div data-testid="group">
          Group: {g.group.members.map(name).join(', ')}
          {g.group.marks.map((m) => (
            <div key={m.by}>
              {name(m.by)} → {name(m.target)}
            </div>
          ))}
        </div>
      )}
      {g.phase === 'hidden' && g.me?.inGroup && (
        <div className="targets">
          {view.players.map((p) => (
            <button key={p.seat} data-testid={`mark-${p.seat}`} onClick={() => send({ t: 'act', action: { kind: 'mark', target: p.seat } })}>
              Mark {p.name}
            </button>
          ))}
        </div>
      )}
      {view.me.kind === 'moderator' && view.status === 'playing' && (
        <button data-testid="advance" onClick={() => send({ t: 'advance' })}>
          Next phase
        </button>
      )}
      {g.reveal && (
        <ul data-testid="reveal">
          {g.reveal.map((r) => (
            <li key={r.seat}>
              {name(r.seat)}: {r.secret}
              {r.inGroup ? ' (group)' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
