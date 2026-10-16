// Lobby: who is here, ready state, invite, mic check (incl. denied/failed), settings, help.
import { type Profile, normalizeName } from '@moonveil/protocol';
import { useState } from 'react';
import type { SessionState } from '../../game/session.ts';
import type { SeatView } from '../../game/types.ts';
import { Avatar, Button, Meter } from '../components/index.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import type { Mic } from '../voice/mic.ts';
import { copyText } from '../lan.ts';
import { ProfileEditor, saveProfile } from './Entry.tsx';
import { SettingsRow } from './Settings.tsx';

export function LobbyScreen({ s, view, mic, onHelp, onChat }: { s: SessionState; view: SeatView; mic: Mic; onHelp: () => void; onChat: () => void }) {
  const t = useT();
  const session = useSession();
  const me = view.players.find((p) => p.seat === view.me.seat);
  const link = `${location.origin}/r/${view.code}`;
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [manual, setManual] = useState(false);
  const copy = async (what: 'link' | 'code') => {
    const r = await copyText(what === 'link' ? link : view.code);
    if (r === 'manual') return setManual(true); // insecure origin (LAN http): show the link to long-press
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };
  const missing = Math.max(0, view.limits.minPlayers - view.players.length);
  const allReady = view.players.every((p) => p.ready);
  const host = view.players.find((p) => p.seat === (view.me.host ? view.me.seat : ''));
  return (
    <main className="lobby fade-in" data-testid="lobby" data-ui>
      <header className="row between">
        <div>
          <h1 className="panel-title">{t('lobbyTitle')}</h1>
          <p className="hint">{view.mode === 'moderator' ? t('lobbyModeMod') : t('lobbyModeAuto')} · {t('lobbyPlayers', { n: view.players.length, min: view.limits.minPlayers, max: view.limits.maxPlayers })}</p>
          <p className="hint" data-testid="you">{t('youLabel')}: {view.me.kind === 'moderator' ? `${view.moderator?.name ?? ''} (${t('moderator')})` : me?.name}{view.me.host ? ` · ${t('host')}` : ''}</p>
        </div>
        <div className="row">
          <Button kind="icon" label={t('chat')} onClick={onChat}>💬</Button>
          <Button kind="icon" label={t('help')} onClick={onHelp}>?</Button>
        </div>
      </header>

      <section className="card row wrap between">
        <div className="row">
          <span className="hint">{t('lobbyInvite')}</span>
          <kbd className="code" data-testid="room-code">{view.code}</kbd>
        </div>
        <div className="row">
          <Button kind="secondary" testId="copy-link" onClick={() => void copy('link')}>{copied === 'link' ? t('copied') : t('lobbyCopyLink')}</Button>
          <Button kind="quiet" onClick={() => void copy('code')}>{copied === 'code' ? t('copied') : t('lobbyCopyCode')}</Button>
        </div>
        {manual && (
          <div className="col" style={{ width: '100%' }} data-testid="copy-manual">
            <p className="hint">{t('copyManual')}</p>
            <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
        )}
      </section>

      <section className="card stack">
        <ul className="player-list" data-testid="seats">
          {view.moderator && (
            <li className="player-row">
              <span className={`dot ${view.moderator.connected ? '' : 'off'}`} />
              <span className="nm">{view.moderator.name}</span>
              <span className="pill accent">{t('moderator')}</span>
            </li>
          )}
          {view.players.map((p) => (
            <li key={p.seat} className="player-row" data-testid="seat" data-seat={p.seat} data-ready={p.ready} data-connected={p.connected}>
              <Avatar p={p} />
              <span className="nm grow">{p.name}{p.seat === view.me.seat ? ` (${t('you')})` : ''}</span>
              <span className={`dot ${p.connected ? '' : 'off'}`} aria-label={p.connected ? t('online') : t('offline')} />
              <span className={`pill ${p.ready ? 'ok' : ''}`}>{p.ready ? t('ready') : '…'}</span>
            </li>
          ))}
        </ul>
      </section>

      {view.me.kind === 'player' && <MicCheck mic={mic} voiceMode={s.voiceMode} />}

      {s.error && <p className="danger" role="alert" data-testid="error">{s.error.message}</p>}

      <section className="card stack">
        {view.me.kind === 'player' && me && (
          <Button wide kind={me.ready ? 'secondary' : 'primary'} testId="ready" pressed={me.ready} onClick={() => session.send({ t: 'ready', ready: !me.ready })}>
            {me.ready ? t('notReady') : t('ready')}
          </Button>
        )}
        {view.me.host ? (
          <>
            <Button wide testId="start" disabled={!view.canStart} onClick={() => session.send({ t: 'start' })}>{t('lobbyStart')}</Button>
            {!view.canStart && <p className="hint center">{missing > 0 ? t('lobbyNeedMore', { n: missing }) : allReady ? t('waiting') : t('lobbyNotAllReady')}</p>}
          </>
        ) : (
          <p className="hint center">{host ? t('lobbyHostStarts', { name: host.name }) : t('waiting')}</p>
        )}
        <div className="btn-row">
          {view.me.kind === 'player' && <Button kind="quiet" testId="edit-profile" onClick={() => setEditing(!editing)}>{editing ? t('done') : t('lobbyEditLook')}</Button>}
          <Button kind="quiet" testId="leave" onClick={() => session.leave()}>{t('leave')}</Button>
        </div>
        {editing && me && <EditProfile initial={{ name: me.name, appearance: me.appearance }} onDone={() => setEditing(false)} />}
      </section>
      <SettingsRow />
    </main>
  );
}

function EditProfile({ initial, onDone }: { initial: Profile; onDone: () => void }) {
  const t = useT();
  const session = useSession();
  const [p, setP] = useState(initial);
  const name = normalizeName(p.name);
  return (
    <div className="stack">
      <ProfileEditor value={p} onChange={setP} />
      <Button wide testId="save-profile" disabled={!name} onClick={() => { saveProfile({ ...p, name }); session.send({ t: 'profile', profile: { ...p, name } }); onDone(); }}>{t('lobbySave')}</Button>
    </div>
  );
}

export function MicCheck({ mic, voiceMode }: { mic: Mic; voiceMode: 'remote' | 'inPerson' }) {
  const t = useT();
  if (voiceMode === 'inPerson') {
    return (
      <section className="card stack" data-testid="mic" data-status="inPerson">
        <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
        <p className="hint">{t('micInPerson')}</p>
      </section>
    );
  }
  const st = mic.status;
  return (
    <section className="card stack" data-testid="mic" data-status={st}>
      <div className="row between">
        <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
        {st === 'ok' && <span className="pill ok">{t('ok')}</span>}
        {(st === 'denied' || st === 'error') && <span className="pill danger">{t('off')}</span>}
        {mic.textOnly && <span className="pill warn">{t('micText')}</span>}
      </div>
      {st === 'idle' && <p className="hint">{t('micIdle')}</p>}
      {st === 'checking' && <p className="hint">{t('micChecking')}</p>}
      {st === 'ok' && (
        <>
          <p className="hint">{t('micOk')}</p>
          <Meter value={mic.level} />
        </>
      )}
      {(st === 'denied' || st === 'error') && (
        <>
          <p className="danger">{t('micDenied')}</p>
          <p className="hint">{t('micDeniedHelp')}</p>
        </>
      )}
      {st === 'unsupported' && <p className="warn">{t('micUnsupported')}</p>}
      {st === 'insecure' && <p className="warn">{t('micInsecure')}</p>}
      {mic.textOnly && <p className="hint">{t('micTextOn')}</p>}
      <div className="btn-row">
        {(st === 'idle' || st === 'checking') && <Button kind="secondary" testId="mic-check" disabled={st === 'checking'} onClick={() => void mic.check()}>{t('micCheck')}</Button>}
        {(st === 'denied' || st === 'error' || st === 'insecure' || st === 'unsupported') && <Button kind="secondary" testId="mic-retry" onClick={() => void mic.check()}>{t('micRetry')}</Button>}
        {st !== 'ok' && !mic.textOnly && st !== 'idle' && st !== 'checking' && <Button kind="quiet" testId="mic-text" onClick={() => mic.setTextOnly(true)}>{t('micText')}</Button>}
        {st === 'ok' && <Button kind="quiet" onClick={() => mic.stop()}>{t('done')}</Button>}
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('micLater')}</p>
    </section>
  );
}
