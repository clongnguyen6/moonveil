// End reveal, role card, help, chat, ghost bar, voice bar, connection overlay.
import type { Role } from '@moonveil/rules';
import { useEffect, useRef, useState } from 'react';
import type { ConnStatus, SessionState } from '../../game/session.ts';
import { canListen, canSpeak, nameAt, playerAt, rolesInPlay } from '../../game/select.ts';
import { endReason } from '../../game/approved.ts';
import type { ChannelId, GameView, SeatView } from '../../game/types.ts';
import { Avatar, Button, Sheet, Tabs } from '../components/index.tsx';
import { SeatGrid } from '../components/SeatGrid.tsx';
import { ChatLine } from '../components/ChatOverlay.tsx';
import { type T, useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import type { Mic } from '../voice/mic.ts';
import { useVoiceClient } from '../voice/useVoiceClient.ts';
import { voicePhase } from '../voice/phase.ts';
import { useBoundedVoice } from '../voice/useBoundedVoice.ts';

const roleDesc = (t: T, r: Role) => t(`roleDesc${r[0]!.toUpperCase()}${r.slice(1)}` as 'roleDescWolf');
const teamOf = (r: Role) => (r === 'wolf' ? 'wolves' : 'village');

export function EndPanel({ view, g }: { view: SeatView; g: GameView }) {
  const t = useT();
  const session = useSession();
  const o = g.outcome;
  const why = endReason(g);
  const title = o?.winner === 'village' ? t('endVillage') : o?.winner === 'wolves' ? t('endWolves') : why === 'stalemate' ? t('endStalemate') : o?.winner === 'draw' ? t('endDraw') : t('endByModerator');
  const reason = why === 'noWolves' ? t('endReasonNoWolves') : why === 'parity' ? t('endReasonParity') : why === 'zeroSurvivors' ? t('endReasonZero') : why === 'stalemate' ? t('endReasonStalemate') : t('endReasonByModerator');
  const [showHistory, setShowHistory] = useState(false);
  return (
    <section className="card panel rise-in" data-testid="ended" data-winner={o?.winner ?? ''} data-reason={why ?? ''}>
      <div className="panel-head">
        <h2 className={`panel-title ${o?.winner === 'wolves' ? 'team-wolves' : o?.winner === 'village' ? 'team-village' : ''}`} data-testid="end-title">{title}</h2>
        <span className="pill">{t('phaseEnded')}</span>
      </div>
      <p className="hint">{reason}</p>
      <h3 className="hint" style={{ fontWeight: 700 }}>{t('endReveal')}</h3>
      <SeatGrid view={view} g={g} testPrefix="reveal" />
      {g.reveal?.history && (
        <>
          <Button kind="quiet" onClick={() => setShowHistory(!showHistory)}>{t('endHistory')}</Button>
          {showHistory && (
            <ul className="log" data-testid="history">
              {g.reveal.history.map((h, i) => {
                if (h.t === 'night') {
                  const r = h.record;
                  return (
                    <li key={i}>
                      <strong>{t('phaseNight', { n: h.night })}</strong>: {t('modVictim')} {r.victim === null ? '—' : nameAt(view, g, r.victim)}
                      {r.heals.some((x) => x === true) ? ` · ${t('modHeal')}` : ''}
                      {r.poisons.map((p, s) => (typeof p === 'number' ? ` · ${t('modPoison')} ${nameAt(view, g, p)} (${nameAt(view, g, s)})` : '')).join('')}
                      {r.guards.map((p, s) => (typeof p === 'number' ? ` · ${t('modGuard')} ${nameAt(view, g, p)} (${nameAt(view, g, s)})` : '')).join('')}
                      {h.deaths.length ? ` · ${h.deaths.map((d) => `${nameAt(view, g, d.seat)} (${d.cause})`).join(', ')}` : ''}
                    </li>
                  );
                }
                if (h.t === 'seerResult') return <li key={i}>{t('phaseNight', { n: h.night })}: {t('modInspect')} {nameAt(view, g, h.target)} → {h.result === 'wolf' ? t('resultWolf') : h.result === 'notWolf' ? t('resultNotWolf') : t.role(h.result)}</li>;
                return <li key={i} className="muted">{t('moderator')}: {h.command.type}</li>;
              })}
            </ul>
          )}
        </>
      )}
      <Button wide kind="secondary" testId="leave" onClick={() => session.leave()}>{t('leave')}</Button>
    </section>
  );
}

export function RoleCardSheet({ view, g, onClose }: { view: SeatView; g: GameView; onClose: () => void }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const me = g.me;
  return (
    <Sheet title={t('roleCard')} onClose={onClose} testId="role-sheet">
      {me ? (
        <div className="stack">
          <button type="button" className={`role-card ${shown ? '' : 'hidden-face'}`} onClick={() => setShown(!shown)} aria-pressed={shown} data-testid="role-card" data-shown={shown}>
            {shown ? (
              <>
                <span className="hint">{t('roleYouAre')}</span>
                <span className={`role-name team-${teamOf(me.role)}`} data-testid="my-role">{t.role(me.role)}</span>
                <span className={`pill`}>{t('roleTeam')}: {teamOf(me.role) === 'wolves' ? t('teamWolves') : t('teamVillage')}</span>
                <p className="hint">{roleDesc(t, me.role)}</p>
                <span className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('roleKeepSecret')}</span>
              </>
            ) : (
              <span className="hint">{t('roleTapReveal')}</span>
            )}
          </button>
          {shown && g.pack && (
            <div>
              <h3 className="hint" style={{ fontWeight: 700 }}>{t('rolePack')}</h3>
              <div className="row wrap">
                {g.pack.seats.map((w) => {
                  const p = playerAt(view, g, w);
                  return p ? <span key={w} className="row pill"><Avatar p={p} /> {p.name}</span> : null;
                })}
              </div>
            </div>
          )}
          {shown && (
            <div>
              <h3 className="hint" style={{ fontWeight: 700 }}>{t('roleFacts')}</h3>
              <ul className="facts" data-testid="facts">
                {me.facts.filter((f) => f.k !== 'role').length === 0 && <li className="muted">{t('roleNoFacts')}</li>}
                {me.facts.map((f, i) => {
                  if (f.k === 'inspect') return <li key={i}>{t('phaseNight', { n: f.night })}: {nameAt(view, g, f.target)} — {f.result === 'wolf' ? t('resultWolf') : f.result === 'notWolf' ? t('resultNotWolf') : t.role(f.result)}</li>;
                  if (f.k === 'victim') return <li key={i}>{t('phaseNight', { n: f.night })}: {f.target === null ? t('witchNoVictim') : t('witchVictim', { name: nameAt(view, g, f.target) })}</li>;
                  if (f.k === 'packTarget') return <li key={i}>{t('phaseNight', { n: f.night })}: {t('modVictim')} {f.target === null ? '—' : nameAt(view, g, f.target)}</li>;
                  if (f.k === 'own') return <li key={i}>{t('phaseNight', { n: f.night })}: {f.act === 'protect' ? t('modGuard') : f.act === 'heal' ? t('modHeal') : t('modPoison')} {f.target === null ? '—' : nameAt(view, g, f.target)}</li>;
                  return null;
                })}
              </ul>
              {me.potions && (
                <div className="potions" style={{ marginTop: 8 }}>
                  <span className={`pill ${me.potions.heal ? 'ok' : ''}`}>{t('potionHeal')}{me.potions.heal ? '' : ` · ${t('potionUsed')}`}</span>
                  <span className={`pill ${me.potions.poison ? 'danger' : ''}`}>{t('potionPoison')}{me.potions.poison ? '' : ` · ${t('potionUsed')}`}</span>
                </div>
              )}
            </div>
          )}
          <RolesInPlay g={g} />
        </div>
      ) : (
        <RolesInPlay g={g} />
      )}
    </Sheet>
  );
}

export function RolesInPlay({ g }: { g: GameView }) {
  const t = useT();
  return (
    <div>
      <h3 className="hint" style={{ fontWeight: 700 }}>{t('roleInPlay')}</h3>
      <div className="row wrap" data-testid="roles-in-play">
        {rolesInPlay(g).map((r) => (
          <span key={r} className={`pill team-${teamOf(r)}`}>{t.role(r)} × {g.roleCounts[r]}</span>
        ))}
      </div>
    </div>
  );
}

export function HelpSheet({ g, onClose, limits }: { g: GameView | null; onClose: () => void; limits?: { min: number; max: number } }) {
  const t = useT();
  return (
    <Sheet title={t('helpTitle')} onClose={onClose} testId="help-sheet">
      <div className="stack">
        <p>{t('helpFlow')}</p>
        <p>{t('helpWin')}</p>
        <h3 className="hint" style={{ fontWeight: 700 }}>{t('helpRoles')}</h3>
        <ul className="facts">
          {(g ? rolesInPlay(g) : (['wolf', 'villager', 'seer', 'guard', 'witch', 'hunter'] as Role[])).map((r) => (
            <li key={r}><strong className={`team-${teamOf(r)}`}>{t.role(r)}</strong> — {roleDesc(t, r)}{r === 'seer' || r === 'guard' ? <> <span className="pill warn">{t('provisional')}</span></> : null}</li>
          ))}
        </ul>
        <h3 className="hint" style={{ fontWeight: 700 }}>{t('helpRulesApproved')}</h3>
        <ul className="facts">
          <li>{t('helpRuleVote')}</li>
          <li>{t('helpRuleExec')}</li>
          <li>{t('helpRuleNight')}</li>
          <li>{t('helpWitch')}</li>
          <li>{t('helpRuleHunter')}</li>
          <li>{t('helpRuleReveal')}</li>
          <li>{t('helpRuleGhost')}</li>
          {limits && <li>{t('helpRulePlayers', limits)}</li>}
        </ul>
        <h3 className="hint" style={{ fontWeight: 700 }}>{t('helpProvisional')} <span className="pill warn">{t('provisional')}</span></h3>
        <ul className="facts" data-testid="help-provisional">
          <li>{t('helpProvSeer')}</li>
          <li>{t('helpProvGuard')}</li>
          <li>{t('helpProvWolfPass')}</li>
        </ul>
      </div>
    </Sheet>
  );
}

const CHANNEL_LABEL: Record<ChannelId, 'chatPublic' | 'chatWolves' | 'chatGhosts'> = { public: 'chatPublic', wolves: 'chatWolves', ghosts: 'chatGhosts' };

/** Channels come ONLY from the seat's grants. A channel without a grant is not rendered at all. */
export function ChatSheet({ s, view, onClose }: { s: SessionState; view: SeatView; onClose: () => void }) {
  const t = useT();
  const session = useSession();
  const channels = view.voice.filter((v) => v.listen).map((v) => v.channel as ChannelId);
  const [tab, setTab] = useState<ChannelId>(channels[0] ?? 'public');
  const active = channels.includes(tab) ? tab : (channels[0] ?? 'public');
  const [text, setText] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const msgs = s.chat.filter((m) => m.channel === active);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [msgs.length, active]);
  const speak = canSpeak(view, active);
  if (channels.length === 0) {
    // No listen grant on any channel (e.g. a living non-wolf at night). Same button, same sheet; no channel named.
    return (
      <Sheet title={t('chatTitle')} onClose={onClose} testId="chat-sheet">
        <p className="muted" data-testid="chat-quiet">{t('chatQuiet')}</p>
      </Sheet>
    );
  }
  const submit = () => {
    const v = text.trim();
    if (!v || !speak) return;
    session.send({ t: 'say', channel: active, text: v });
    setText('');
  };
  return (
    <Sheet title={t('chatTitle')} onClose={onClose} testId="chat-sheet">
      <div className="chat">
        {channels.length > 1 && <Tabs tabs={channels.map((c) => ({ key: c, label: t(CHANNEL_LABEL[c]) }))} value={active} onChange={setTab} testId="chat-tab" dataKey="channel" />}
        <div className="chat-log" ref={log} data-testid="chat-log" data-channel={active}>
          {msgs.length === 0 && <p className="muted">{t('chatNone')}</p>}
          {msgs.map((e) => <ChatLine key={e.msg.id} view={view} entry={e} />)}
        </div>
        {speak ? (
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input className="input" value={text} maxLength={500} placeholder={t('chatPh')} onChange={(e) => setText(e.target.value)} data-testid="chat-input" />
            <Button type="submit" testId="chat-send" disabled={!text.trim()}>{t('send')}</Button>
          </form>
        ) : (
          <p className="muted" data-testid="chat-listen-only">{t('chatListenOnly')}</p>
        )}
      </div>
    </Sheet>
  );
}

export function GhostBar({ view, g }: { view: SeatView; g: GameView }) {
  const t = useT();
  const me = g.me;
  if (!me || me.alive) return null;
  const d = g.seats[me.seat]?.death;
  const why = d?.cause === 'executed' ? t('ghostExecuted') : d?.cause === 'shot' ? t('ghostShot') : d?.cause === 'removed' ? t('ghostRemoved') : t('ghostDiedNight');
  const pending = g.step.kind === 'hunter' && g.step.pending.includes(me.seat);
  return (
    <div className="card ghost-bar fade-in" data-testid="ghost-bar">
      <span className="pill ghost">👻 {t('ghostTitle')}</span>
      <span className="hint grow">{why} {pending ? t('hunterIso') : canListen(view, 'ghosts') ? t('ghostHint') : ''}</span>
    </div>
  );
}

/** Mic button + channel label strictly from grants. No grant for a channel = no trace of it. */
export function VoiceBar({ s, view, mic, night }: { s: SessionState; view: SeatView; mic: Mic; night?: boolean }) {
  const t = useT();
  const session = useSession();
  const { client: vc, snap } = useVoiceClient(session);
  const speakOn = view.voice.filter((v) => v.speak).map((v) => v.channel as ChannelId);
  const off = s.voiceMode === 'inPerson';
  const listenOnly = speakOn.length === 0;
  // One mic model: the VoiceClient when it exists (real voice), else the local check (stub / no sessions yet).
  const muted = snap ? snap.muted : mic.muted;
  const micBad = snap ? snap.mic === 'denied' || snap.mic === 'failed' : mic.status === 'denied' || mic.status === 'error';
  const toggle = () => (vc && snap ? void vc.setMuted(!snap.muted) : mic.setMuted(!mic.muted));
  const notJoined = !off && !s.voiceJoined;
  const serverOff = s.voiceAvailable === false;
  const raw = off ? 'off' : notJoined ? 'notJoined' : vc ? voicePhase(snap, { off, joined: s.voiceJoined, canSpeak: !listenOnly }) : s.voiceSessions === 0 ? 'connecting' : micBad ? 'failed' : listenOnly ? 'listening' : 'live';
  const phase = useBoundedVoice(raw, s.voiceJoined && !off);
  const busy = phase === 'connecting' || phase === 'reconnecting';
  const retry = async () => { await session.voiceLeave?.(); await session.voiceJoin?.(); };
  const label = off ? t('voiceOff') : serverOff ? t('voiceServerOff') : notJoined ? t('voiceJoin') : phase === 'connecting' ? t('voiceConnecting') : phase === 'reconnecting' ? t('voiceReconnecting') : phase === 'unavailable' ? t('voiceUnavailable') : phase === 'failed' ? t('voiceFailed') : listenOnly ? t('voiceListen') : micBad ? t('voiceMicOff') : muted ? t('voiceMuted') : t(CHANNEL_LABEL[speakOn[0]!]);
  const unlock = snap?.audioBlocked ? <Button kind="secondary" testId="audio-unlock" onClick={() => void vc?.unlockAudio()}>{t('voiceUnlock')}</Button> : null;
  // Night: one neutral button for every seat, no channel label, so the top bar gives no role tell at a glance.
  // A wolf's tap still toggles mute (grant-driven); the label is in the aria text only.
  if (night) {
    return (
      <div className="mic-bar" data-testid="voice" data-speak={speakOn.join(',')} data-mic={snap?.mic ?? mic.status} data-voice={phase}>
        {/* never `disabled` here: a dimmed button would mark the seats that cannot speak */}
        <Button kind="icon" label={label} onClick={() => (serverOff ? undefined : phase === 'unavailable' || phase === 'failed' ? void retry() : notJoined ? void session.voiceJoin?.() : !off && !listenOnly && toggle())}>🎙️</Button>
        {unlock}
      </div>
    );
  }
  return (
    <div className="mic-bar" data-testid="voice" data-speak={speakOn.join(',')} data-mic={snap?.mic ?? mic.status} data-muted={muted} data-joined={!notJoined && !off} data-voice={phase}>
      <Button kind="icon" label={serverOff ? t('voiceServerOff') : phase === 'unavailable' || phase === 'failed' ? t('voiceRetry') : notJoined ? t('voiceJoin') : muted ? t('voiceUnmute') : t('voiceMute')} pressed={!off && !notJoined && !listenOnly && !muted && !micBad && phase === 'live'} disabled={off || serverOff || (!notJoined && phase !== 'unavailable' && phase !== 'failed' && (listenOnly || micBad))} testId={serverOff ? 'voice-off' : phase === 'unavailable' || phase === 'failed' ? 'voice-retry' : notJoined ? 'voice-join' : 'voice-mute'} onClick={() => (serverOff ? undefined : phase === 'unavailable' || phase === 'failed' ? void retry() : notJoined ? void session.voiceJoin?.() : toggle())}>
        {off || notJoined || listenOnly || muted || micBad ? '🔇' : '🎙️'}
      </Button>
      <span className={`pill voice-label ${busy ? 'pulse' : ''}`} data-testid="voice-label">{busy ? '⟳ ' : ''}{label}</span>
      {unlock}
    </div>
  );
}

export function ConnOverlay({ status, serverRestart }: { status: ConnStatus; serverRestart?: boolean }) {
  const t = useT();
  const session = useSession();
  if (status === 'idle') return null;
  if (status === 'open' || status === 'connecting') {
    return <span className="banner ok conn-chip" role="status" data-testid="conn" data-status={status}>{status === 'open' ? t('connConnected') : t('waiting')}</span>;
  }
  return (
    <div className="conn-overlay" role="status" data-testid="conn" data-status={status}>
      <div className="card raised stack">
        {status === 'reconnecting' && (
          <>
            <p className="panel-title pulse">{t('connReconnecting')}</p>
            <p className="hint" data-testid="conn-hint" data-restart={!!serverRestart}>{serverRestart ? t('connRestartHint') : t('connReconnectHint')}</p>
          </>
        )}
        {status === 'replaced' && (
          <>
            <p className="panel-title">{t('connReplaced')}</p>
            <Button onClick={() => session.reclaim()}>{t('connUseHere')}</Button>
          </>
        )}
        {/* Involuntary end (room closed, seat removed, tab could not reclaim): a voluntary Leave never shows this, it goes home. */}
        {status === 'ended' && (
          <>
            <p className="panel-title">{t('connEnded')}</p>
            <Button testId="go-home" onClick={() => session.goHome()}>{t('connGoHome')}</Button>
          </>
        )}
      </div>
    </div>
  );
}
