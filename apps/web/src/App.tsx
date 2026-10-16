// Shell UI: home (create/join), profile, lobby, connection banner. Game rendering belongs to other scopes;
// the in-game panel here is PROVISIONAL (fixture engine only).
import {
  APPEARANCE_COLORS,
  APPEARANCE_HATS,
  type Appearance,
  type Mode,
  NAME_MAX,
  normalizeName,
  type Profile,
  type SeatView,
} from '@moonveil/protocol';
import { useState, useSyncExternalStore } from 'react';
import { Client, type ClientState } from './client.ts';
import { FixtureGame } from './provisional/FixtureGame.tsx';

export const client = new Client();
// Debug/e2e handle. Holds only this seat's own data.
(globalThis as { __moonveil?: Client }).__moonveil = client;

const PROFILE_KEY = 'moonveil.profile';
function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Profile | null;
    if (p && APPEARANCE_COLORS.includes(p.appearance.color) && APPEARANCE_HATS.includes(p.appearance.hat)) return p;
  } catch {}
  return { name: '', appearance: { color: APPEARANCE_COLORS[0], hat: 'none' } };
}
function saveProfile(p: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

const roomFromPath = () => /^\/r\/([A-Za-z0-9]{6})\/?$/.exec(location.pathname)?.[1]?.toUpperCase() ?? null;

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  const code = roomFromPath();
  if (code) client.resume(code);
}

export function App() {
  boot();
  const s = useSyncExternalStore(client.subscribe, client.getState);
  return (
    <main className="shell">
      <header className="top">
        <h1>Moonveil</h1>
        <Banner s={s} />
      </header>
      {s.view ? <Room view={s.view} s={s} /> : <Entry s={s} />}
    </main>
  );
}

function Banner({ s }: { s: ClientState }) {
  if (s.status === 'reconnecting' || (s.status === 'connecting' && s.view))
    return <p className="banner warn" role="status" data-testid="conn">Reconnecting…</p>;
  if (s.status === 'replaced')
    return (
      <p className="banner warn" role="status" data-testid="conn">
        Opened in another tab. <button onClick={() => client.reclaim()}>Use here</button>
      </p>
    );
  if (s.status === 'open') return <p className="banner ok" data-testid="conn" data-status="open">Connected</p>;
  return null;
}

function Entry({ s }: { s: ClientState }) {
  const linkCode = roomFromPath();
  const [profile, setProfile] = useState(loadProfile);
  const [code, setCode] = useState(linkCode ?? '');
  const busy = s.status === 'connecting' || s.status === 'reconnecting';
  const valid = normalizeName(profile.name).length > 0;
  const go = (fn: (p: Profile) => void) => {
    const p = { ...profile, name: normalizeName(profile.name) };
    saveProfile(p);
    fn(p);
  };
  return (
    <section className="card">
      <ProfileEditor value={profile} onChange={setProfile} />
      {s.error && <p className="error" role="alert" data-testid="error">{s.error.message}</p>}
      <div className="join">
        <label>
          Room code
          <input
            data-testid="code"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
        <button data-testid="join" disabled={!valid || busy || code.length !== 6} onClick={() => go((p) => client.join(code, p))}>
          Join
        </button>
      </div>
      {!linkCode && (
        <div className="create">
          <p>Or start a new room:</p>
          <CreateButton mode="automatic" label="Create & play (automatic)" disabled={!valid || busy} onCreate={(m) => go((p) => client.create(m, p))} />
          <CreateButton mode="moderator" label="Create & moderate (not playing)" disabled={!valid || busy} onCreate={(m) => go((p) => client.create(m, p))} />
        </div>
      )}
    </section>
  );
}

function CreateButton(props: { mode: Mode; label: string; disabled: boolean; onCreate: (m: Mode) => void }) {
  return (
    <button data-testid={`create-${props.mode}`} disabled={props.disabled} onClick={() => props.onCreate(props.mode)}>
      {props.label}
    </button>
  );
}

function ProfileEditor({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const setA = (a: Partial<Appearance>) => onChange({ ...value, appearance: { ...value.appearance, ...a } });
  return (
    <div className="profile">
      <label>
        Name
        <input
          data-testid="name"
          value={value.name}
          maxLength={NAME_MAX}
          autoComplete="nickname"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <fieldset>
        <legend>Colour</legend>
        <div className="swatches">
          {APPEARANCE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch c-${c}`}
              aria-label={c}
              aria-pressed={value.appearance.color === c}
              data-testid={`color-${c}`}
              onClick={() => setA({ color: c })}
            />
          ))}
        </div>
      </fieldset>
      <label>
        Hat
        <select data-testid="hat" value={value.appearance.hat} onChange={(e) => setA({ hat: e.target.value as Appearance['hat'] })}>
          {APPEARANCE_HATS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Room({ view, s }: { view: SeatView; s: ClientState }) {
  const me = view.players.find((p) => p.seat === view.me.seat);
  const link = `${location.origin}/r/${view.code}`;
  const [editing, setEditing] = useState(false);
  return (
    <section className="room" data-testid="room" data-status={view.status} data-kind={view.me.kind}>
      <div className="card roomhead">
        <div>
          Room <strong data-testid="room-code">{view.code}</strong> · {view.mode === 'moderator' ? 'Moderated' : 'Automatic'}
        </div>
        <button onClick={() => void navigator.clipboard?.writeText(link)} data-testid="copy-link">
          Copy invite link
        </button>
        <div className="you" data-testid="you">
          You: {view.me.kind === 'moderator' ? `${view.moderator?.name ?? ''} (moderator)` : (me?.name ?? '')}
          {view.me.host && ' · host'}
        </div>
      </div>
      {s.error && <p className="error" role="alert" data-testid="error">{s.error.message}</p>}

      <ul className="seats card" data-testid="seats">
        {view.moderator && (
          <li className="seat mod">
            <span className="dot" data-on={view.moderator.connected} /> {view.moderator.name} <em>moderator</em>
          </li>
        )}
        {view.players.map((p) => (
          <li key={p.seat} className="seat" data-testid="seat" data-seat={p.seat} data-ready={p.ready} data-connected={p.connected}>
            <span className={`avatar c-${p.appearance.color}`} title={p.appearance.hat} />
            <span className="dot" data-on={p.connected} aria-label={p.connected ? 'online' : 'offline'} />
            <span className="nm">{p.name}</span>
            {p.seat === view.me.seat && <em>you</em>}
            {view.status === 'lobby' && <span className="rd">{p.ready ? 'ready' : '…'}</span>}
          </li>
        ))}
      </ul>

      {view.status === 'lobby' && (
        <div className="card actions">
          <p>
            {view.players.length} players · need {view.limits.minPlayers}–{view.limits.maxPlayers}
          </p>
          {view.me.kind === 'player' && me && (
            <button data-testid="ready" aria-pressed={me.ready} onClick={() => client.send({ t: 'ready', ready: !me.ready })}>
              {me.ready ? 'Not ready' : 'Ready'}
            </button>
          )}
          {view.me.host && (
            <button data-testid="start" disabled={!view.canStart} onClick={() => client.send({ t: 'start' })}>
              Start game
            </button>
          )}
          {view.me.kind === 'player' && me && (
            <button onClick={() => setEditing(!editing)} data-testid="edit-profile">
              {editing ? 'Done' : 'Edit look'}
            </button>
          )}
          <button className="quiet" data-testid="leave" onClick={() => client.leave()}>
            Leave
          </button>
          {editing && me && <EditProfile initial={{ name: me.name, appearance: me.appearance }} onDone={() => setEditing(false)} />}
        </div>
      )}

      {view.status !== 'lobby' && <FixtureGame view={view} send={(m) => client.send(m)} />}
    </section>
  );
}

function EditProfile({ initial, onDone }: { initial: Profile; onDone: () => void }) {
  const [p, setP] = useState(initial);
  const name = normalizeName(p.name);
  return (
    <div className="edit">
      <ProfileEditor value={p} onChange={setP} />
      <button
        data-testid="save-profile"
        disabled={!name}
        onClick={() => {
          saveProfile({ ...p, name });
          client.send({ t: 'profile', profile: { ...p, name } });
          onDone();
        }}
      >
        Save
      </button>
    </div>
  );
}
