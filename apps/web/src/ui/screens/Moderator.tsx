// Moderator console. Approved powers: close step, enter the Yes count (in-person verdict), listen to every channel.
// Day ballots are open to every viewer (approved), so the moderator sees them like anyone else (Log tab + public log).
// APPROVED: the separate moderator may end the match (typed confirmation; no winner; full reveal).
// Speaking, acting for seats and removal are provisional: hidden unless the engine config enables them.
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../game/local-store.ts';
import { mod } from '../../game/commands.ts';
import { nameAt } from '../../game/select.ts';
import type { GameView, SeatView } from '../../game/types.ts';
import { Button, Confirm, Tabs } from '../components/index.tsx';
import { SeatGrid } from '../components/SeatGrid.tsx';
import { useT } from '../i18n/index.ts';
import { useSession, useSessionState } from '../session-context.ts';

type Tab = 'flow' | 'seats' | 'night' | 'log';

export function ModeratorConsole({ view, g }: { view: SeatView; g: GameView }) {
  const t = useT();
  const session = useSession();
  const [tab, setTab] = useState<Tab>('flow');
  const [ask, setAsk] = useState<null | { text: string; yes: string; run: () => void; danger?: boolean }>(null);
  const m = g.moderator;
  const stepName = t.step(g.step.kind);
  const living = g.seats.filter((s) => s.alive).length;
  const [yes, setYes] = useState(0);
  const sendMod = (action: Record<string, unknown>) => session.send({ t: 'act', action });
  // PROVISIONAL powers (not approved): only if the engine config carries an enabling flag. No flag today → hidden.
  const cfg = (m?.config as { moderator?: Record<string, unknown> } | undefined)?.moderator ?? {};
  const canRemove = cfg['canRemove'] === true;
  const [ending, setEnding] = useState(false);
  const [typed, setTyped] = useState('');
  // INTERIM fallback (pre-rules-12 engine): if the approved match.end comes back "malformed", send match.abort once.
  const endSentAt = useRef(0);
  const sessionState = useSessionState();
  useEffect(() => {
    const e = sessionState.error;
    if (!e || endSentAt.current === 0 || Date.now() - endSentAt.current > 2000) return;
    if (e.code === 'invalid-action' && /malformed/.test(e.message)) {
      endSentAt.current = 0;
      session.send({ t: 'act', action: mod.endMatchLegacy() });
    }
  }, [sessionState.error, session]);
  const narration = useSettings().modNarration;
  const ended = g.step.kind === 'ended';
  return (
    <section className="card panel rise-in mod-secret" data-testid="mod-console">
      <div className="panel-head">
        <h2 className="panel-title">{t('modConsole')}</h2>
        <span className="pill warn">{t('modSecretWarn')}</span>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'flow', label: t('modStep') }, { key: 'seats', label: t('modSeats') }, { key: 'night', label: t('modNight') }, { key: 'log', label: t('modLog') }]} />

      {tab === 'flow' && (
        <div className="stack">
          <p><strong data-testid="mod-step">{stepName}</strong> · {g.step.kind.startsWith('night') ? t('phaseNight', { n: g.night }) : t('phaseDiscuss', { d: g.day }).split(' ·')[0]} · {t('livingCount', { n: living })}</p>
          <p className="hint">{view.phaseEndsAt === null ? t('modNoTimer') : ''}</p>
          {narration && <p className="card" style={{ padding: 10 }} data-testid="mod-say">🗣 {narrate(t, g, view)} <span className="pill warn">{t('provisional')}</span></p>}
          {m?.nightRec && g.step.kind.startsWith('night') && <p className="hint">{t('modSubmitted', { n: submittedCount(g), total: expectedCount(g) })}</p>}
          {g.step.kind === 'hunter' && <p className="hint">{t('hunterOthers', { name: g.step.pending.map((p) => nameAt(view, g, p)).join(', ') })}</p>}
          {g.step.kind === 'day.confirm' && (
            <div className="card stack" style={{ padding: 12 }}>
              <label className="field col" style={{ gap: 4 }}>
                {t('modYesCount')}
                <input className="input" type="number" min={0} max={living} value={yes} onChange={(e) => setYes(Number(e.target.value))} data-testid="yes-count" />
              </label>
              <p className="hint">{t('modYesHint')}</p>
              <Button kind="secondary" testId="yes-apply" onClick={() => sendMod(mod.yesCount(yes))}>{t('modApply')}</Button>
            </div>
          )}
          <Button wide testId="close-step" disabled={ended} onClick={() => setAsk({ text: t('modCloseConfirm', { step: stepName }), yes: t('modCloseStep'), run: () => sendMod(mod.closeStep()) })}>{t('modCloseStep')} →</Button>
        </div>
      )}

      {tab === 'flow' && !ended && (
        <section className="card end-match stack" style={{ padding: 12, marginTop: 8 }} data-testid="end-match" data-open={ending}>
          <p className="hint"><strong>{t('endMatchTitle')}</strong> · {t('endMatchHint')}</p>
          {!ending ? (
            <Button kind="danger" testId="end-match-open" onClick={() => { setEnding(true); setTyped(''); }}>{t('endMatchOpen')}</Button>
          ) : (
            <>
              <label className="field col" style={{ gap: 4 }}>
                {t('endMatchType', { word: t('endMatchWord') })}
                <input className="input" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} data-testid="end-match-input" />
              </label>
              <div className="btn-row">
                <Button kind="quiet" testId="end-match-cancel" onClick={() => { setEnding(false); setTyped(''); }}>{t('cancel')}</Button>
                <Button kind="danger" testId="end-match-confirm" disabled={typed.trim().toUpperCase() !== t('endMatchWord').toUpperCase()} onClick={() => { endSentAt.current = Date.now(); sendMod(mod.endMatch()); setEnding(false); setTyped(''); }}>{t('endMatchConfirm')}</Button>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'seats' && (
        <div className="stack">
          <SeatGrid view={view} g={g} testPrefix="mod-seat" roles="all" />
          {canRemove && <div className="row wrap">
            {g.seats.filter((s) => s.alive).map((s) => (
              <Button key={s.seat} kind="quiet" disabled={ended} onClick={() => setAsk({ text: t('modRemoveConfirm', { name: nameAt(view, g, s.seat) }), yes: t('modRemove'), danger: true, run: () => sendMod(mod.remove(s.seat)) })}>
                {t('modRemove')}: {nameAt(view, g, s.seat)}
              </Button>
            ))}
          </div>}
        </div>
      )}

      {tab === 'night' && m && (
        <ul className="log" data-testid="mod-night">
          {!m.nightRec && <li className="muted">—</li>}
          {m.nightRec && (
            <>
              <li><strong>{t('phaseNight', { n: m.nightRec.night })}</strong></li>
              <li>{t('modPicks')}: {m.nightRec.wolfPicks.map((p, s) => (p === null ? null : `${nameAt(view, g, s)} → ${p === 'pass' ? t('pass') : nameAt(view, g, p)}`)).filter(Boolean).join(', ') || '—'}</li>
              <li>{t('modVictim')}: {m.nightRec.victim === null ? '—' : nameAt(view, g, m.nightRec.victim)}</li>
              <li>{t('modInspect')}: {m.nightRec.inspections.map((p, s) => (p === null ? null : `${nameAt(view, g, s)} → ${nameAt(view, g, p)}`)).filter(Boolean).join(', ') || '—'}</li>
              <li>{t('modGuard')}: {m.nightRec.guards.map((p, s) => (p === null ? null : `${nameAt(view, g, s)} → ${p === 'pass' ? t('pass') : nameAt(view, g, p)}`)).filter(Boolean).join(', ') || '—'}</li>
              <li>{t('modHeal')}: {m.nightRec.heals.map((p, s) => (p === null ? null : `${nameAt(view, g, s)}: ${p ? t('witchHeal') : t('witchNoHeal')}`)).filter(Boolean).join(', ') || '—'}</li>
              <li>{t('modPoison')}: {m.nightRec.poisons.map((p, s) => (p === null ? null : `${nameAt(view, g, s)} → ${p === 'pass' ? t('pass') : nameAt(view, g, p)}`)).filter(Boolean).join(', ') || '—'}</li>
            </>
          )}
        </ul>
      )}

      {tab === 'log' && <PublicLog view={view} g={g} />}

      {ask && <Confirm text={ask.text} yes={ask.yes} danger={ask.danger} onNo={() => setAsk(null)} onYes={() => { ask.run(); setAsk(null); }} />}
    </section>
  );
}

function narrate(t: ReturnType<typeof useT>, g: GameView, view: SeatView): string {
  const s = g.step;
  switch (s.kind) {
    case 'night.main': return t('sayNightMain');
    case 'night.witch': return t('sayNightWitch');
    case 'hunter': return t('sayHunter', { name: s.pending.map((p) => nameAt(view, g, p)).join(', ') });
    case 'day.discussion': { const d = g.publicLog.filter((e) => e.t === 'dawn').at(-1); const dead = d && d.t === 'dawn' ? d.dead.map((x) => nameAt(view, g, x)).join(', ') : ''; return dead ? t('sayDawnDead', { names: dead }) : t('sayDawnNobody'); }
    case 'day.vote': return t('sayVote');
    case 'day.defense': return t('sayDefense', { name: nameAt(view, g, s.accused) });
    case 'day.confirm': return t('sayConfirm', { name: nameAt(view, g, s.accused) });
    case 'ended': return t('sayEnded');
  }
}
/** Moderator-only: how many night inputs are in (from the moderator projection's night record). */
function submittedCount(g: GameView): number {
  const r = g.moderator?.nightRec;
  if (!r) return 0;
  if (g.step.kind === 'night.witch') return (r.heals.filter((x) => x !== null).length > 0 ? 1 : 0) + (r.poisons.filter((x) => x !== null).length > 0 ? 1 : 0);
  return r.wolfPicks.filter((x) => x !== null).length + r.inspections.filter((x) => x !== null).length + r.guards.filter((x) => x !== null).length;
}
function expectedCount(g: GameView): number {
  const seats = g.moderator?.seats ?? [];
  if (g.step.kind === 'night.witch') return seats.filter((s) => s.alive && s.role === 'witch').length * 2;
  return seats.filter((s) => s.alive && (s.role === 'wolf' || s.role === 'seer' || s.role === 'guard')).length;
}

export function PublicLog({ view, g }: { view: SeatView; g: GameView }) {
  const t = useT();
  const n = (s: number | null) => (s === null ? '—' : nameAt(view, g, s));
  return (
    <ul className="log" data-testid="public-log">
      {g.publicLog.map((e, i) => {
        switch (e.t) {
          case 'nightStart': return <li key={i}><strong>{t('phaseNight', { n: e.night })}</strong></li>;
          case 'dawn': return <li key={i}>{t('dawnTitle')}: {e.dead.length ? t('dawnDied', { names: e.dead.map(n).join(', ') }) : t('dawnNobody')}</li>;
          case 'dayStart': return <li key={i}><strong>{t('phaseDiscuss', { d: e.day }).split(' ·')[0]}</strong></li>;
          case 'nomination': return <li key={i}>{e.accused === null ? t('voteNoTrialTie') : t('voteTrial', { name: n(e.accused) })} ({e.tally.map((x) => `${x.target === 'skip' ? t('skip') : n(x.target)} ${x.count}`).join(', ')})</li>;
          case 'confirm': return <li key={i}>{e.counted === 'moderator' ? t('confirmYesOnly', { yes: e.yes }) : t('confirmResult', { yes: e.yes, no: e.no ?? 0 })} → {e.executed ? t('confirmExecuted', { name: n(e.accused) }) : t('confirmSpared', { name: n(e.accused) })}</li>;
          case 'executed': return <li key={i} className="danger">{t('annExecuted', { name: n(e.seat) })}</li>;
          case 'hunterTurn': return <li key={i}>{t('annHunter', { name: e.seats.map(n).join(', ') })}</li>;
          case 'shot': return <li key={i}>{e.target === null ? t('hunterNoShot', { by: n(e.by) }) : t('hunterShot', { by: n(e.by), target: n(e.target) })}</li>;
          case 'roleRevealed': return <li key={i}>{n(e.seat)}: {t.role(e.role)}</li>;
          case 'removed': return <li key={i}>{t('modRemove')}: {n(e.seat)}</li>;
          case 'ended': return <li key={i}><strong>{t('annOver')}</strong></li>;
        }
      })}
    </ul>
  );
}
