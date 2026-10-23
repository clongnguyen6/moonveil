// Root of the player/moderator UI. Pure function of SessionState: every screen re-renders from the latest
// snapshot, so reconnect = render the same view again. Phase skin + announcements derive from public data.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FixtureGame } from '../provisional/FixtureGame.tsx';
import { SceneMount } from './SceneMount.tsx';
import { useWakeLock } from './lan.ts';
import { useSettings } from '../game/local-store.ts';
import { nameAt, projection } from '../game/select.ts';
import { stalemateWarning } from '../game/approved.ts';
import { SAVE_BOUND_MS, lookDraft, sameLook, useLookDraft } from '../game/look-draft.ts';
import type { Session, SessionState } from '../game/session.ts';
import { type GameView, type SeatView, stepFamily as famOf } from '../game/types.ts';
import { type Cue, playCues, unlockAudio } from './audio/cues.ts';
import { Button, Sheet, Timer, type ToastItem, Toasts } from './components/index.tsx';
import { type T, useT } from './i18n/index.ts';
import { ConfirmPanel, DefensePanel, DiscussionPanel, GhostPanel, VotePanel } from './screens/Day.tsx';
import { ChatOverlay } from './components/ChatOverlay.tsx';
import { EntryScreen } from './screens/Entry.tsx';
import { LobbyScreen } from './screens/Lobby.tsx';
import { ModeratorConsole } from './screens/Moderator.tsx';
import { HunterPanel, NightPanel } from './screens/Night.tsx';
import { ChatSheet, ConnOverlay, EndPanel, GhostBar, HelpSheet, RoleCardSheet, VoiceBar } from './screens/Panels.tsx';
import { SettingsPanel } from './screens/Settings.tsx';
import { SessionContext, useSession, useSessionState } from './session-context.ts';
import { errorText, screenError, stampError } from './errors.ts';
import { applyTheme, themeNote, useThemeNote } from './theme/theme.ts';
import { useMic } from './voice/mic.ts';

export function GameApp({ session, children }: { session: Session; children?: React.ReactNode }) {
  return (
    <SessionContext.Provider value={session}>
      <Root />
      {children}
    </SessionContext.Provider>
  );
}

function phaseSkin(view: SeatView | null, g: GameView | null): 'day' | 'night' | 'ghost' | 'ended' {
  if (!view || view.status === 'lobby' || !g) return 'day';
  if (g.step.kind === 'ended') return 'ended';
  if (g.me && !g.me.alive) return 'ghost';
  return famOf(g.step.kind) === 'night' ? 'night' : 'day';
}

function Root() {
  const s = useSessionState();
  const session = useSession();
  const settings = useSettings();
  const t = useT();
  const view = s.view;
  stampError(s);   // before any screen reads it (errors.ts)
  const g = projection(view);
  const skin = phaseSkin(view, g);
  const mic = useMic();
  const [sheet, setSheet] = useState<null | 'role' | 'help' | 'chat' | 'settings'>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  useEffect(() => {
    document.documentElement.dataset.phase = skin;
    document.documentElement.dataset.motion = settings.reducedMotion === 'on' ? 'reduce' : settings.reducedMotion === 'off' ? 'full' : 'system';
    document.documentElement.lang = settings.lang;
  }, [skin, settings.reducedMotion, settings.lang]);
  useEffect(() => {
    const unlock = () => unlockAudio();
    addEventListener('pointerdown', unlock, { once: true });
    return () => removeEventListener('pointerdown', unlock);
  }, []);
  const { toasts, overlay, live } = useAnnouncer(view, g, t, s.status);
  useLookRules(s, view, t);
  const wake = useWakeLock(!!view && view.status === 'playing');
  // Theme (Settings): UI accents + scene overlay together, consistent on load failure (ui/theme/theme.ts)
  useEffect(() => { void applyTheme(settings.theme); }, [settings.theme]);
  const themeFailed = useThemeNote();
  useEffect(() => { if (themeFailed) { const id = setTimeout(() => themeNote.clear(), 8000); return () => clearTimeout(id); } }, [themeFailed]);
  // Heavy-run rule: automation sets globalThis.__MOONVEIL_SCENE = 'off' (or MOONVEIL_SCENE for the scene package); the
  // shell skips the mount entirely so no software WebGL runs. 'low' | 'high' are passed to the scene (visual-7).
  const sceneKnob = (globalThis as { __MOONVEIL_SCENE?: string }).__MOONVEIL_SCENE;
  const sceneOn = settings.scene && sceneKnob !== 'off';

  return (
    <div className="app" data-testid="app" data-phase={skin}>
      {!view ? (
        <EntryScreen s={s} />
      ) : (
        <div className="frame" data-testid="room" data-status={view.status} data-kind={view.me.kind} data-step={g?.step.kind ?? ''} data-wake={wake}>
          {view.status === 'lobby' || !g ? (
            <>
              <div className="scene-host">
                {view.engine !== 'fixture' && sceneOn && <SceneMount s={s} topbarRef={{ current: null }} micOn={mic.status === 'ok' && !mic.muted} />}
                {view.engine !== 'fixture' && <ChatOverlay s={s} view={view} onHistory={() => setSheet('chat')} />}
              </div>
              <div className="dock">
                {view.status === 'lobby' ? (
                  <LobbyScreen s={s} view={view} mic={mic} onHelp={() => setSheet('help')} onChat={() => setSheet('chat')} onSettings={() => setSheet('settings')} />
                ) : (
                  <div className="card" style={{ padding: 12 }}>
                    <p className="hint" data-testid="you">{t('youLabel')}: {view.me.kind === 'moderator' ? view.moderator?.name : view.players.find((p) => p.seat === view.me.seat)?.name}</p>
                    <FixtureGame view={view} send={(m) => session.send(m)} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <Match s={s} view={view} g={g} mic={mic} open={setSheet} overlay={overlay} wakeFailed={wake === 'failed' || wake === 'unsupported'} scene={sceneOn} />
          )}
        </div>
      )}
      <Toasts items={toasts} />
      {themeFailed && <p className="toast-note" role="status" data-testid="theme-note">{t('themeFailed')}</p>}
      {/* Polite live region: phase titles + public announcements only (same text as toasts/overlays, never role data). */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live">{live}</div>
      {sheet === 'role' && g && view && <RoleCardSheet view={view} g={g} onClose={closeSheet} />}
      {sheet === 'help' && <HelpSheet g={g} onClose={closeSheet} limits={view ? { min: view.limits.minPlayers, max: view.limits.maxPlayers } : undefined} />}
      {sheet === 'chat' && view && <ChatSheet s={s} view={view} onClose={closeSheet} />}
      {sheet === 'settings' && (
        <Sheet title={t('settings')} onClose={closeSheet} testId="settings-sheet">
          <SettingsPanel moderator={view?.me.kind === 'moderator'} />
        </Sheet>
      )}
      <ConnOverlay status={s.status} serverRestart={s.serverRestart} />
    </div>
  );
}

function phaseTitle(t: T, g: GameView): string {
  const k = g.step;
  switch (k.kind) {
    case 'night.main':
    case 'night.witch': return t('phaseNight', { n: k.night });
    case 'hunter': return t('phaseHunter');
    case 'day.discussion': return t('phaseDiscuss', { d: k.day });
    case 'day.vote': return t('phaseVote', { d: k.day });
    case 'day.defense': return t('phaseDefense', { d: k.day });
    case 'day.confirm': return t('phaseConfirm', { d: k.day });
    case 'ended': return t('phaseEnded');
  }
}

function Match({ s, view, g, mic, open, overlay, wakeFailed, scene }: { s: SessionState; view: SeatView; g: GameView; mic: ReturnType<typeof useMic>; open: (x: 'role' | 'help' | 'chat' | 'settings') => void; overlay: Announcement | null; wakeFailed: boolean; scene: boolean }) {
  const t = useT();
  const isMod = view.me.kind === 'moderator';
  const fam = famOf(g.step.kind);
  const topbar = useRef<HTMLDivElement>(null);
  return (
    <main className="frame" data-testid="match" data-step={g.step.kind} aria-label={phaseTitle(t, g)}>
      <div className="scene-host">
        {scene && <SceneMount s={s} topbarRef={topbar} micOn={mic.status === 'ok' && !mic.muted} />}
        <div className="topbar" ref={topbar} data-ui role="toolbar" aria-label={t('app')}>
          <div className="titles">
            <h1 className="title" data-testid="phase-title">{phaseTitle(t, g)}</h1>
            <div className="sub" data-testid="you">{view.code} · {isMod ? t('moderator') : nameAt(view, g, g.viewer.kind === 'seat' ? g.viewer.seat : null)}</div>
          </div>
          <div className="tools">
            {!isMod && <VoiceBar s={s} view={view} mic={mic} night={fam === 'night'} />}
            <Button kind="icon" label={t('chat')} testId="open-chat" onClick={() => open('chat')}>💬</Button>
            {!isMod && <Button kind="icon" label={t('roleCard')} testId="open-role" onClick={() => open('role')}>🎭</Button>}
            <Button kind="icon" label={t('help')} testId="open-help" onClick={() => open('help')}>?</Button>
            <Button kind="icon" label={t('settings')} testId="open-settings" onClick={() => open('settings')}>⚙</Button>
          </div>
        </div>
        <ChatOverlay s={s} view={view} onHistory={() => open('chat')} />
        {overlay && (
          <div className="overlay-announce announce-life" data-testid="announce" data-ms={overlay.ms} key={overlay.id} aria-hidden="true">
            <div className="rise-in">
              <h2>{overlay.title}</h2>
              {overlay.body && <p className="hint" style={{ fontSize: 'var(--fs-3)' }}>{overlay.body}</p>}
            </div>
          </div>
        )}
      </div>
      <div className="dock" key={`${g.step.kind}:${g.night}:${g.day}`}>
        {wakeFailed && <p className="muted center" style={{ fontSize: 'var(--fs-0)', margin: '0 0 6px' }} data-testid="wake-hint">{t('wakeHint')}</p>}
        {stalemateWarning(g) && g.step.kind !== 'ended' && <p className="card warn-banner" role="status" data-testid="stalemate-warning">⚠ {t('stalemateWarning')}</p>}
        {!isMod && <GhostBar view={view} g={g} />}
        {isMod ? (
          <ModeratorConsole view={view} g={g} />
        ) : g.step.kind === 'ended' ? (
          <EndPanel view={view} g={g} />
        ) : g.me && !g.me.alive && !(g.step.kind === 'hunter' && g.step.pending.includes(g.me.seat)) ? (
          <GhostPanel view={view} g={g} speaking={s.speaking} title={phaseTitle(t, g)} />
        ) : fam === 'night' ? (
          <NightPanel view={view} g={g} />
        ) : fam === 'hunter' ? (
          <HunterPanel view={view} g={g} />
        ) : g.step.kind === 'day.discussion' ? (
          <DiscussionPanel view={view} g={g} speaking={s.speaking} />
        ) : g.step.kind === 'day.vote' ? (
          <VotePanel view={view} g={g} speaking={s.speaking} />
        ) : g.step.kind === 'day.defense' ? (
          <DefensePanel view={view} g={g} speaking={s.speaking} />
        ) : (
          <ConfirmPanel view={view} g={g} speaking={s.speaking} />
        )}
        {isMod && view.phaseEndsAt !== null && <p className="center"><Timer endsAt={view.phaseEndsAt} totalMs={view.phaseDurationMs} /></p>}
        {screenError(s) && <p className="danger center" role="alert" data-testid="error" data-code={screenError(s)!.code}>{errorText(t, screenError(s))}</p>}
      </div>
    </main>
  );
}

interface Announcement { id: number; title: string; body?: string; ms: number }

/** Look-editor rules that depend on the session: confirm on a matching snapshot, bound the pending save, discard on
 *  reconnect / seat or room change / leaving the lobby. Pure function of SessionState + the draft store. */
function useLookRules(s: SessionState, view: SeatView | null, t: T) {
  const look = useLookDraft();
  const ctx = view ? `${view.code}:${view.me.seat}` : null;
  useEffect(() => {
    if (!look.draft && !look.pendingSince) return;
    // context lost: reconnecting/replaced, another room or seat, lobby left or match started
    if (s.status !== 'open' || !view || look.ctx !== ctx || view.status !== 'lobby') { lookDraft.clear(); return; }
    if (look.pendingSince !== null) {
      const mine = view.players.find((p) => p.seat === view.me.seat);
      if (mine && look.draft && sameLook(mine.appearance, look.draft.appearance)) { lookDraft.confirmed(); return; }
      if (s.error && s.error !== look.errorBefore && s.error.code !== 'network') { lookDraft.failed(); return; }   // only an error newer than Save
      const left = SAVE_BOUND_MS() - (Date.now() - look.pendingSince);
      const id = setTimeout(() => lookDraft.failed(), Math.max(0, left));
      return () => clearTimeout(id);
    }
  }, [s.status, s.error, view, look, ctx]);
  useEffect(() => {
    if (look.notice) { const id = setTimeout(() => lookDraft.clearNotice(), 6000); return () => clearTimeout(id); }
  }, [look.notice]);
  void t;
}

/** Turns new public-log entries and step changes into toasts, overlays and audio cues. Public data only. */
// Dawn overlay length: names must be readable; it never blocks anything (click-through, under the top bar and chat box).
const DAWN_NOBODY_MS = 3200;
export const dawnMs = (deaths: number) => (deaths === 0 ? DAWN_NOBODY_MS : Math.min(7000, 4500 + 600 * (deaths - 1)));

function useAnnouncer(view: SeatView | null, g: GameView | null, t: T, status: SessionState['status']) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [overlay, setOverlay] = useState<Announcement | null>(null);
  const [live, setLive] = useState('');
  const seen = useRef<{ code: string | null; log: number; step: string | null }>({ code: null, log: 0, step: null });
  // After a reconnect the first snapshot is adopted silently (no late overlay for events missed while away; the last-night
  // recap in the panels shows the dawn result). A reload starts fresh and is silent the same way.
  const resync = useRef(false);
  if (status === 'reconnecting' || status === 'connecting') resync.current = true;
  const idRef = useRef(0);
  const push = useCallback((text: string, kind?: ToastItem['kind']) => {
    const id = ++idRef.current;
    setToasts((xs) => [...xs, { id, text, kind }].slice(-3));
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 3500);
  }, []);
  const show = useCallback((title: string, body?: string, ms = 3200) => {
    const id = ++idRef.current;
    setOverlay({ id, title, body, ms });
    setTimeout(() => setOverlay((o) => (o?.id === id ? null : o)), ms);
  }, []);
  useEffect(() => {
    if (!view || !g) return;
    const st = seen.current;
    if (st.code !== view.code || resync.current) {
      // (Re)connect, reload or new room: adopt the current state silently; never replay history as new announcements.
      resync.current = false;
      seen.current = { code: view.code, log: g.publicLog.length, step: g.step.kind };
      return;
    }
    const cues: Cue[] = [];
    const said: string[] = [];   // one polite live-region message per update: phase first, then what happened
    const announce = (text: string) => { said.push(text); };
    const me = g.me?.seat ?? null;
    for (const e of g.publicLog.slice(st.log)) {
      const n = (s: number | null) => nameAt(view, g, s);
      switch (e.t) {
        case 'nightStart': cues.push('night'); show(t('annNight')); announce(t('annNight')); break;
        case 'dawn': {
          cues.push(e.dead.length ? 'death' : 'dawn');
          const others = e.dead.filter((s) => s !== me).map(n).join(', ');
          const body = !e.dead.length ? t('dawnNobody') : me !== null && e.dead.includes(me) ? (others ? t('dawnYouAlso', { names: others }) : t('dawnYou')) : t('dawnDied', { names: others });
          show(t('dawnTitle'), body, dawnMs(e.dead.length));
          announce(body);
          break;
        }
        case 'nomination': { const x = e.accused === null ? t('voteNoTrialTie') : t('voteTrial', { name: n(e.accused) }); push(x); announce(x); break; }
        case 'confirm': { const x = e.counted === 'moderator' ? t('confirmYesOnly', { yes: e.yes }) : t('confirmResult', { yes: e.yes, no: e.no ?? 0 }); push(x); announce(x); break; }
        case 'executed': { cues.push('death'); const x = t('annExecuted', { name: n(e.seat) }); show(x); announce(x); break; }
        case 'hunterTurn': { cues.push('attention'); const x = t('annHunter', { name: e.seats.map(n).join(', ') }); push(x, 'warn'); announce(x); break; }
        case 'stalemateWarning': cues.push('attention'); push(t('stalemateWarning'), 'warn'); announce(t('stalemateWarning')); break;
        case 'shot': if (e.target !== null) { cues.push('death'); const x = t('annShot', { by: n(e.by), target: n(e.target) }); show(x); announce(x); } else { const x = t('hunterNoShot', { by: n(e.by) }); push(x); announce(x); } break;
        case 'ended': cues.push(g.outcome?.winner === 'wolves' ? (g.me?.role === 'wolf' ? 'victory' : 'defeat') : g.outcome?.winner === 'village' ? (g.me?.role === 'wolf' ? 'defeat' : 'victory') : 'dawn'); break;
        default: break;
      }
    }
    if (st.step !== g.step.kind) {
      said.unshift(phaseTitle(t, g));
      if (g.step.kind === 'day.vote') { cues.push('vote'); push(t('annVote')); said.push(t('annVote')); }
      if (g.step.kind === 'day.confirm') { cues.push('vote'); push(t('annConfirm')); said.push(t('annConfirm')); }
      if (g.step.kind === 'day.defense') { push(t('annDefense')); said.push(t('annDefense')); }
      if (g.me?.actions.length && famOf(g.step.kind) !== 'night') cues.push('attention');
    }
    const msg = [...new Set(said)].map((x) => x.replace(/[.\s]+$/, '')).join('. ');
    if (msg) setLive(msg);
    if (cues.length) playCues(cues);
    seen.current = { code: view.code, log: g.publicLog.length, step: g.step.kind };
  }, [view, g, t, push, show]);
  return { toasts, overlay, live };
}
