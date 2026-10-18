// Lobby: who is here, ready state, invite, mic check (incl. denied/failed), settings, help.
import { NAME_MAX, normalizeName } from '@moonveil/protocol';
import { useEffect, useState } from 'react';
import { lookDraft, useLookDraft } from '../../game/look-draft.ts';
import type { SessionState } from '../../game/session.ts';
import type { SeatView } from '../../game/types.ts';
import { Avatar, Button, Meter } from '../components/index.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import type { Mic } from '../voice/mic.ts';
import { useVoiceClient } from '../voice/useVoiceClient.ts';
import { ROLES, type Role } from '@moonveil/rules';
import { qrMatrix, qrPath } from '../qr.ts';
import { platform } from '../voice/guidance.ts';
import { voicePhase } from '../voice/phase.ts';
import { useBoundedVoice } from '../voice/useBoundedVoice.ts';
import { copyText } from '../lan.ts';
import { errorText } from '../errors.ts';
import { saveProfile } from './Entry.tsx';
import { LookPicker } from '../components/LookPicker.tsx';
import { type LookProfile, lookOf } from '../../game/look.ts';

export function LobbyScreen({ s, view, mic, onHelp, onChat, onSettings }: { s: SessionState; view: SeatView; mic: Mic; onHelp: () => void; onChat: () => void; onSettings: () => void }) {
  const t = useT();
  const session = useSession();
  const me = view.players.find((p) => p.seat === view.me.seat);
  const [origin, setOrigin] = useState(location.origin);
  useEffect(() => { void session.inviteBase?.().then(setOrigin).catch(() => {}); }, [session]);
  const link = `${origin}/r/${view.code}`;
  const [editing, setEditing] = useState(false);
  // Live preview while editing your look: shared local draft (You card, list, scene override); never sent until Save.
  const look = useLookDraft();
  const draft = look.draft;
  const ctx = `${view.code}:${view.me.seat}`;
  const shown = (p: typeof view.players[number]) => (draft && p.seat === view.me.seat ? { name: p.name, appearance: draft.appearance } : p);
  // When the draft ends for any reason (confirmed, rejected, discarded by reconnect/context), close the editor too.
  useEffect(() => { setEditing(false); }, [look.ended]);
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
          <Button kind="icon" label={t('settings')} testId="open-settings" onClick={onSettings}>⚙</Button>
        </div>
      </header>

      {/* 1. Invite: code, link, QR (host) in one card */}
      <section className="card stack" data-testid="invite">
        <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('lobbyInviteTitle')}</h2>
        <div className="row wrap between">
          <div className="row">
            <span className="hint">{t('entryCode')}</span>
            <kbd className="code" data-testid="room-code">{view.code}</kbd>
          </div>
          <div className="row">
            <Button kind="secondary" testId="copy-link" onClick={() => void copy('link')}>{copied === 'link' ? t('copied') : t('lobbyCopyLink')}</Button>
            <Button kind="quiet" onClick={() => void copy('code')}>{copied === 'code' ? t('copied') : t('lobbyCopyCode')}</Button>
          </div>
        </div>
        {manual && (
          <div className="col" style={{ width: '100%' }} data-testid="copy-manual">
            <p className="hint">{t('copyManual')}</p>
            <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
        )}
        {view.me.host && <QrCard link={link} />}
      </section>

      {/* 2. Room settings (host) / Room (everyone else): voice mode + deck */}
      <section className="card stack" data-testid="room-settings" data-host={view.me.host}>
        <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{view.me.host ? t('lobbyRoomTitle') : t('lobbyRoomInfo')}</h2>
        {view.me.host && <p className="line">{t('lobbyRoomHostLine')}</p>}
        {view.me.host ? (
          <div className="field" data-testid="voice-mode" data-mode={s.voiceMode}>
            <span>{t('voiceModeLabel')}</span>
            <div className="choice" role="radiogroup" aria-label={t('voiceModeLabel')}>
              <label data-checked={s.voiceMode === 'remote'}>
                <input type="radio" name="voicemode" checked={s.voiceMode === 'remote'} data-testid="voice-mode-remote" onChange={() => session.send({ t: 'voiceMode', voiceMode: 'remote' })} />
                <span className="meta"><span className="lbl">{t('voiceModeRemote')}</span><span className="line">{t('voiceModeRemoteLine')}</span></span>
              </label>
              <label data-checked={s.voiceMode === 'inPerson'}>
                <input type="radio" name="voicemode" checked={s.voiceMode === 'inPerson'} data-testid="voice-mode-inperson" onChange={() => session.send({ t: 'voiceMode', voiceMode: 'inPerson' })} />
                <span className="meta"><span className="lbl">{t('voiceModeInPerson')}</span><span className="line">{t('voiceModeInPersonLine')}</span></span>
              </label>
            </div>
          </div>
        ) : (
          <p data-testid="room-voice-mode" data-mode={s.voiceMode}><strong>{t('voiceModeLabel')}:</strong> {s.voiceMode === 'inPerson' ? t('voiceModeInPerson') : t('voiceModeRemote')} <span className="line">— {s.voiceMode === 'inPerson' ? t('voiceModeInPersonLine') : t('voiceModeRemoteLine')}</span></p>
        )}
        {view.deck && <DeckCard view={view} />}
      </section>

      {/* 3. Players */}
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
              <Avatar p={shown(p)} />
              <span className="nm grow">{p.name}{p.seat === view.me.seat ? ` (${t('you')})` : ''}</span>
              <span className={`dot ${p.connected ? '' : 'off'}`} aria-label={p.connected ? t('online') : t('offline')} />
              <span className={`pill ${p.ready ? 'ok' : ''}`}>{p.ready ? t('ready') : '…'}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. You: ready, look, voice */}
      {view.me.kind === 'player' && me && (
        <section className="card stack" data-testid="you-card">
          <div className="row" data-testid="you-look" data-outfit={lookOf((draft ?? me).appearance, me.seat).outfit} data-variant={lookOf((draft ?? me).appearance, me.seat).variant} data-color={(draft ?? me).appearance.color} data-hat={(draft ?? me).appearance.hat}>
            <Avatar p={shown(me)} size="lg" />
            <div className="col" style={{ gap: 2 }}><strong>{me.name}</strong>{draft && <span className="line" data-testid="you-preview">{look.pendingSince ? t('lookSaving') : t('lookPreview')}</span>}</div>
          </div>
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('lobbyYouTitle')}</h2>
          <Button wide kind={me.ready ? 'secondary' : 'primary'} testId="ready" pressed={me.ready} onClick={() => session.send({ t: 'ready', ready: !me.ready })}>
            {me.ready ? t('notReady') : t('ready')}
          </Button>
          <div className="btn-row">
            <Button kind="quiet" testId="edit-profile" onClick={() => { if (editing) lookDraft.clear(); setEditing(!editing); }}>{editing ? t('cancel') : t('lobbyEditLook')}</Button>
            <Button kind="quiet" testId="leave" onClick={() => session.leave()}>{t('leave')}</Button>
          </div>
          {editing && <EditProfile initial={{ name: me.name, appearance: lookOf(me.appearance, me.seat) }} onChange={(p) => lookDraft.set(p, ctx)} onDone={() => { lookDraft.markSaved(); setEditing(false); }} onCancel={() => { lookDraft.clear(); setEditing(false); }} />}
          {look.notice === 'notSaved' && <p className="danger" role="alert" data-testid="look-not-saved">{t('lookNotSaved')}</p>}
        </section>
      )}
      {view.me.kind === 'player' && <MicCheck mic={mic} voiceMode={s.voiceMode} joined={s.voiceJoined} sessions={s.voiceSessions} serverOff={s.voiceAvailable === false} />}

      {s.error && <p className="danger" role="alert" data-testid="error" data-code={s.error.code}>{errorText(t, s.error)}</p>}

      {/* 5. Start (host) */}
      {view.me.host ? (
        <section className="card stack" data-testid="start-card">
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('lobbyStartTitle')}</h2>
          <Button wide testId="start" disabled={!view.canStart} onClick={() => session.send({ t: 'start' })}>{t('lobbyStart')}</Button>
          <p className="line center">{view.canStart ? t('lobbyStartLine') : missing > 0 ? t('lobbyNeedMore', { n: missing }) : allReady ? t('lobbyStartLine') : t('lobbyNotAllReady')}</p>
          {view.me.kind === 'moderator' && <Button kind="quiet" testId="leave" onClick={() => session.leave()}>{t('leave')}</Button>}
        </section>
      ) : (
        <p className="hint center">{host ? t('lobbyHostStarts', { name: host.name }) : t('waiting')}</p>
      )}
    </main>
  );
}

/** Lobby deck (public): engine default for this player count, the host's custom counts, validation error. Host edits. */
function DeckCard({ view }: { view: SeatView }) {
  const t = useT();
  const session = useSession();
  const d = view.deck!;
  const shown = d.custom ?? d.default;
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const roles = ROLES as readonly Role[];
  const total = (c: Record<string, number>) => roles.reduce((n, r) => n + (c[r] ?? 0), 0);
  const editing = draft !== null;
  const counts = draft ?? shown ?? {};
  const bump = (r: Role, by: number) => setDraft({ ...counts, [r]: Math.max(0, (counts[r] ?? 0) + by) });
  return (
    <div className="stack" data-testid="deck" data-custom={d.custom !== null} data-error={d.error !== null}>
      <div className="row between">
        <span className="lbl" style={{ fontWeight: 600 }}>{t('deckTitle')}</span>
        <span className={`pill ${d.custom ? 'warn' : ''}`}>{d.custom ? t('deckCustom') : t('deckDefault')}</span>
      </div>
      <p className="line">{t('deckLine')}</p>
      {shown === null && !editing && <p className="hint">{t('deckNone', { n: view.players.length })}</p>}
      <div className="row wrap" data-testid="deck-counts">
        {roles.map((r) => (
          <span key={r} className={`pill team-${r === 'wolf' ? 'wolves' : 'village'}`} data-role={r} data-count={counts[r] ?? 0}>
            {editing && view.me.host && <button type="button" className="btn icon" style={{ width: 28, minHeight: 28 }} aria-label={`- ${t.role(r)}`} onClick={() => bump(r, -1)}>−</button>}
            {t.role(r)} × {counts[r] ?? 0}
            {editing && view.me.host && <button type="button" className="btn icon" style={{ width: 28, minHeight: 28 }} aria-label={`+ ${t.role(r)}`} onClick={() => bump(r, 1)}>+</button>}
          </span>
        ))}
        <span className="pill">{t('deckTotal', { n: total(counts), players: view.players.length })}</span>
      </div>
      {d.error && <p className="danger" role="alert" data-testid="deck-error">{d.error}</p>}
      {view.me.host && (
        <div className="btn-row">
          {!editing && <Button kind="secondary" testId="deck-edit" onClick={() => setDraft({ ...(shown ?? {}) })}>{t('deckEdit')}</Button>}
          {!editing && d.custom && <Button kind="quiet" testId="deck-reset" onClick={() => session.send({ t: 'deck', counts: null })}>{t('deckReset')}</Button>}
          {editing && <Button kind="quiet" onClick={() => setDraft(null)}>{t('cancel')}</Button>}
          {editing && <Button testId="deck-apply" onClick={() => { session.send({ t: 'deck', counts: draft! }); setDraft(null); }}>{t('deckApply')}</Button>}
        </div>
      )}
    </div>
  );
}

/** D1: QR of the invite link on the host's screen (vendored encoder, ui/qr.ts; licence: original Moonveil code). */
function QrCard({ link }: { link: string }) {
  const t = useT();
  let mat: boolean[][] | null = null;
  try { mat = qrMatrix(link); } catch { mat = null; }
  if (!mat) return null;
  const n = mat.length;
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'center' }} data-testid="qr" data-version={(n - 17) / 4}>
      <svg viewBox={`-4 -4 ${n + 8} ${n + 8}`} width="168" height="168" role="img" aria-label={`${t('lobbyQr')}: ${link}`} shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 6 }}>
        <path d={qrPath(mat)} fill="#000" />
      </svg>
      <div className="col" style={{ gap: 4 }}>
        <strong>{t('lobbyQr')}</strong>
        <span className="hint">{t('lobbyQrHint')}</span>
        <span className="muted" style={{ fontSize: 'var(--fs-0)', wordBreak: 'break-all' }}>{link}</span>
      </div>
    </div>
  );
}

// Opens on the seat's real (canonical) look; every change previews locally; Save sends the canonical costume form.
function EditProfile({ initial, onChange, onDone, onCancel }: { initial: LookProfile; onChange: (p: LookProfile) => void; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const session = useSession();
  const [p, setP] = useState(initial);
  const name = normalizeName(p.name);
  const set = (next: LookProfile) => { setP(next); onChange(next); }; // live preview on the You card + list + scene; nothing sent
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="stack" data-testid="edit-look">
      <label className="field col" style={{ gap: 4 }}>
        {t('entryName')}
        <input className="input" data-testid="name" value={p.name} maxLength={NAME_MAX} autoComplete="nickname" onChange={(e) => set({ ...p, name: e.target.value })} />
      </label>
      <LookPicker value={p.appearance} onChange={(appearance) => set({ ...p, appearance })} />
      <p className="line">{t('lookPreviewLine')}</p>
      <div className="btn-row">
        <Button kind="quiet" testId="cancel-profile" onClick={onCancel}>{t('cancel')}</Button>
        <Button testId="save-profile" disabled={!name} onClick={() => { saveProfile({ ...p, name }); session.send({ t: 'profile', profile: { ...p, name } }); onDone(); }}>{t('lobbySave')}</Button>
      </div>
    </div>
  );
}

export function MicGuide({ ua }: { ua?: string }) {
  const t = useT();
  const key = ({ iosSafari: 'micGuideIosSafari', androidChrome: 'micGuideAndroidChrome', desktopChrome: 'micGuideDesktopChrome', desktopSafari: 'micGuideDesktopSafari', firefox: 'micGuideFirefox', other: 'micGuideOther' } as const)[platform(ua)];
  return <p className="hint" data-testid="mic-guide" data-platform={platform(ua)}>{t(key)}</p>;
}

export function MicCheck({ mic, voiceMode, joined, sessions = 1, serverOff = false }: { mic: Mic; voiceMode: 'remote' | 'inPerson'; joined: boolean; sessions?: number; serverOff?: boolean }) {
  const t = useT();
  const session = useSession();
  const { client: vc, snap } = useVoiceClient(session);
  const raw = voiceMode !== 'remote' ? 'off' : !joined ? 'notJoined' : snap ? voicePhase(snap, { off: false, joined, canSpeak: true }) : sessions === 0 ? 'connecting' : 'connecting';
  const phase = useBoundedVoice(raw, joined && voiceMode === 'remote');
  const retry = async () => { await session.voiceLeave?.(); await session.voiceJoin?.(); };
  if (voiceMode === 'remote' && serverOff) {
    // P19: the server says voice is off for this room: no Join voice at all.
    return (
      <section className="card stack" data-testid="mic" data-status="serverOff">
        <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
        <p className="hint">{t('voiceServerOff')}</p>
      </section>
    );
  }
  if (voiceMode === 'remote' && joined && phase === 'unavailable') {
    return (
      <section className="card stack" data-testid="mic" data-status="unavailable" data-voice="unavailable">
        <div className="row between">
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
          <span className="pill danger">{t('off')}</span>
        </div>
        <p className="danger">{t('voiceUnavailable')}</p>
        <p className="hint">{t('voiceUnavailableLine')}</p>
        <div className="btn-row">
          <Button kind="secondary" testId="voice-retry" onClick={() => void retry()}>{t('voiceRetry')}</Button>
          <Button kind="quiet" testId="voice-leave" onClick={() => void session.voiceLeave?.()}>{t('voiceLeave')}</Button>
        </div>
      </section>
    );
  }
  if (voiceMode === 'remote' && !joined) {
    // D2: nothing connects and no mic prompt until this tap.
    return (
      <section className="card stack" data-testid="mic" data-status="notJoined">
        <div className="row between">
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
          <span className="pill">{t('voiceNotJoined')}</span>
        </div>
        <p className="hint">{t('voiceJoinHint')}</p>
        <Button wide testId="voice-join" onClick={() => void session.voiceJoin?.()}>🎙️ {t('voiceJoin')}</Button>
      </section>
    );
  }
  if (!snap && voiceMode === 'remote' && joined) {
    return (
      <section className="card stack" data-testid="mic" data-status="checking" data-voice={phase}>
        <div className="row between">
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
          <span className="pill warn pulse" data-testid="voice-busy">⟳ {t('voiceConnecting')}</span>
        </div>
        <p className="hint">{t('voiceConnectingLine')}</p>
        <Button kind="quiet" testId="voice-leave" onClick={() => void session.voiceLeave?.()}>{t('voiceLeave')}</Button>
      </section>
    );
  }
  if (snap && voiceMode !== 'inPerson') {
    // Real voice: state comes from the single VoiceClient. Joining takes ~10 s on Cloud: say so while it connects.
    const st = snap.mic;
    const busy = phase === 'connecting' || phase === 'reconnecting';
    return (
      <section className="card stack" data-testid="mic" data-status={st === 'granted' ? 'ok' : st === 'requesting' ? 'checking' : st} data-voice={phase}>
        <div className="row between">
          <h2 className="panel-title" style={{ fontSize: 'var(--fs-3)' }}>{t('micTitle')}</h2>
          {phase === 'live' && <span className="pill ok">{t('voiceLive')}</span>}
          {busy && <span className="pill warn pulse" data-testid="voice-busy">⟳ {phase === 'connecting' ? t('voiceConnecting') : t('voiceReconnecting')}</span>}
          {(st === 'denied' || st === 'failed' || phase === 'failed') && <span className="pill danger">{t('off')}</span>}
        </div>
        {busy && <p className="hint">{phase === 'connecting' ? t('voiceConnectingLine') : t('voiceReconnectingLine')}</p>}
        {phase === 'failed' && st !== 'denied' && st !== 'failed' && (<><p className="danger">{t('voiceFailed')}</p><p className="hint">{t('voiceFailedLine')}</p><Button kind="secondary" testId="voice-retry" onClick={() => void retry()}>{t('voiceRetry')}</Button></>)}
        {phase === 'live' && <p className="hint">{snap.muted ? t('voiceMuted') : t('micOkVoice')}</p>}
        {st === 'denied' && (<><p className="danger">{t('micDenied')}</p><MicGuide /></>)}
        {st === 'failed' && (<><p className="danger">{t('micFailed')}</p>{snap.micError && <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{snap.micError}</p>}<MicGuide /></>)}
        {snap.audioBlocked && <Button kind="secondary" testId="audio-unlock" onClick={() => void vc?.unlockAudio()}>{t('voiceUnlock')}</Button>}
        <div className="btn-row">
          {st === 'granted' && <Button kind="secondary" testId="mic-mute" pressed={!snap.muted} onClick={() => void vc?.setMuted(!snap.muted)}>{snap.muted ? t('voiceUnmute') : t('voiceMute')}</Button>}
          {(st === 'denied' || st === 'failed') && <Button kind="quiet" testId="mic-reload" onClick={() => location.reload()}>{t('micRetry')}</Button>}
          <Button kind="quiet" testId="voice-leave" onClick={() => void session.voiceLeave?.()}>{t('voiceLeave')}</Button>
        </div>
      </section>
    );
  }
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
          <MicGuide />
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
        {voiceMode === 'remote' && joined && <Button kind="quiet" testId="voice-leave" onClick={() => void session.voiceLeave?.()}>{t('voiceLeave')}</Button>}
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('micLater')}</p>
    </section>
  );
}
