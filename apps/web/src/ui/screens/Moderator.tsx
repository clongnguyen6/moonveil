// Moderator console. Approved: the moderator listens to everything, cannot speak, see ballots or act for
// players (pending). Controls: close step, Yes-count entry (in-person verdict), remove player, abort.
// Secret state shown = whatever the moderator projection carries (roles, night record), minus ballots.
import { useState } from 'react';
import { mod } from '../../game/commands.ts';
import { nameAt } from '../../game/select.ts';
import type { GameView, SeatView } from '../../game/types.ts';
import { Button, Confirm, Tabs } from '../components/index.tsx';
import { SeatGrid } from '../components/SeatGrid.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';

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
  const sendMod = (action: Record<string, unknown>) => session.send({ t: 'moderate', action });
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
          {g.step.kind === 'hunter' && <p className="hint">{t('hunterOthers', { name: g.step.pending.map((p) => nameAt(view, g, p)).join(', ') })}</p>}
          {g.step.kind === 'day.confirm' && (
            <div className="card stack" style={{ padding: 12 }}>
              <label className="field col" style={{ gap: 4 }}>
                {t('modYesCount')}
                <input className="input" type="number" min={0} max={living} value={yes} onChange={(e) => setYes(Number(e.target.value))} data-testid="yes-count" />
              </label>
              <p className="hint">{t('modYesHint')}</p>
              <Button kind="secondary" testId="yes-apply" onClick={() => sendMod(mod.yesCount(yes))}>{t('modApply')}</Button>
              <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('modPendingApi')} · {t('modNoBallots')}</p>
            </div>
          )}
          {(g.step.kind === 'day.vote') && <p className="muted">{t('modNoBallots')}</p>}
          <Button wide testId="close-step" disabled={ended} onClick={() => setAsk({ text: t('modCloseConfirm', { step: stepName }), yes: t('modCloseStep'), run: () => sendMod(mod.closeStep()) })}>{t('modCloseStep')} →</Button>
          <Button kind="danger" testId="abort" disabled={ended} onClick={() => setAsk({ text: t('modAbortConfirm'), yes: t('modAbort'), danger: true, run: () => sendMod(mod.abort()) })}>{t('modAbort')}</Button>
        </div>
      )}

      {tab === 'seats' && (
        <div className="stack">
          <SeatGrid view={view} g={g} testPrefix="mod-seat" />
          <div className="row wrap">
            {g.seats.filter((s) => s.alive).map((s) => (
              <Button key={s.seat} kind="quiet" disabled={ended} onClick={() => setAsk({ text: t('modRemoveConfirm', { name: nameAt(view, g, s.seat) }), yes: t('modRemove'), danger: true, run: () => sendMod(mod.remove(s.seat)) })}>
                {t('modRemove')}: {nameAt(view, g, s.seat)}
              </Button>
            ))}
          </div>
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
          case 'confirm': return <li key={i}>{t('confirmResult', { yes: e.yes, no: e.no })} → {e.executed ? t('confirmExecuted', { name: n(e.accused) }) : t('confirmSpared', { name: n(e.accused) })}</li>;
          case 'executed': return <li key={i} className="danger">{t('annExecuted', { name: n(e.seat) })}</li>;
          case 'hunterTurn': return <li key={i}>{t('annHunter', { name: e.seats.map(n).join(', ') })}</li>;
          case 'shot': return <li key={i}>{e.target === null ? t('hunterNoShot', { by: n(e.by) }) : t('hunterShot', { by: n(e.by), target: n(e.target) })}</li>;
          case 'roleRevealed': return <li key={i}>{n(e.seat)}: {t.role(e.role)}</li>;
          case 'removed': return <li key={i}>{t('modRemove')}: {n(e.seat)}</li>;
          case 'dayOutcomeSet': return <li key={i}>{t('moderator')}: {e.execute === null ? t('voteNoTrial') : t('annExecuted', { name: n(e.execute) })}</li>;
          case 'ended': return <li key={i}><strong>{t('annOver')}</strong></li>;
        }
      })}
    </ul>
  );
}
