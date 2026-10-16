// Night panels. ONE layout for every role: head + task line + info slot + seat grid + two buttons.
// Roles without an action in the current step get a private note task with the same shape, so the screen
// gives no tell. Durations come from the server deadline; nothing here ends a step.
import type { Fact, Seat } from '@moonveil/rules';

const isInspect = (f: Fact): f is Extract<Fact, { k: 'inspect' }> => f.k === 'inspect';
const isVictim = (f: Fact): f is Extract<Fact, { k: 'victim' }> => f.k === 'victim';
import { useEffect, useState } from 'react';
import { act } from '../../game/commands.ts';
import { type Note, notesStore, useNotes } from '../../game/local-store.ts';
import { action, nameAt } from '../../game/select.ts';
import type { GameView, SeatView } from '../../game/types.ts';
import { Button, Timer } from '../components/index.tsx';
import { SeatGrid } from '../components/SeatGrid.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';

export interface PanelProps { view: SeatView; g: GameView; phaseTotalMs?: number }

function Frame({ title, task, info, children, buttons, status, view, testId }: { title: string; task: string; info?: React.ReactNode; children: React.ReactNode; buttons: React.ReactNode; status?: string; view: SeatView; testId: string }) {
  return (
    <section className="card panel rise-in" data-testid={testId}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        <Timer endsAt={view.phaseEndsAt} />
      </div>
      <p className="hint">{task}</p>
      <div className="info-slot" style={{ minHeight: 44 }}>{info}</div>
      {children}
      <div className="btn-row">{buttons}</div>
      <p className="muted" style={{ fontSize: 'var(--fs-0)', minHeight: 20 }} aria-live="polite">{status}</p>
    </section>
  );
}

/** Pick-one-seat flow shared by wolf, seer, guard, witch poison, hunter. */
function usePick(current: Seat | 'pass' | null | undefined) {
  const [sel, setSel] = useState<Seat | null>(typeof current === 'number' ? current : null);
  useEffect(() => {
    if (typeof current === 'number') setSel(current);
  }, [current]);
  return [sel, setSel] as const;
}

export function NightPanel({ view, g }: PanelProps) {
  const t = useT();
  const step = g.step;
  const me = g.me;
  const title = t('phaseNight', { n: g.night });
  if (!me || !me.alive) return <NotePanel view={view} g={g} title={title} />;
  if (step.kind === 'night.main') {
    if (action(g, 'wolf.pick')) return <WolfPanel view={view} g={g} title={title} />;
    if (action(g, 'seer.inspect') || me.role === 'seer') return <SeerPanel view={view} g={g} title={title} />;
    if (action(g, 'guard.protect')) return <GuardPanel view={view} g={g} title={title} />;
  }
  if (step.kind === 'night.witch' && (action(g, 'witch.heal') || action(g, 'witch.poison') || me.role === 'witch')) {
    return <WitchPanel view={view} g={g} title={title} />;
  }
  return <NotePanel view={view} g={g} title={title} />;
}

function WolfPanel({ view, g, title }: PanelProps & { title: string }) {
  const t = useT();
  const session = useSession();
  const a = action(g, 'wolf.pick')!;
  const [sel, setSel] = usePick(a.current);
  const tags: Record<number, { text: string; accent?: boolean }> = {};
  const picks = g.pack?.picks;
  if (picks) {
    g.pack!.seats.forEach((w) => {
      const p = picks[w];
      if (p === undefined || p === null) return;
      tags[typeof p === 'number' ? p : w] = typeof p === 'number' ? { text: `← ${nameAt(view, g, w)}`, accent: true } : { text: `${nameAt(view, g, w)}: ${t('nightPackPass')}` };
    });
  }
  const info = (
    <div className="row wrap">
      <span className="pill accent">{t('nightPackPicks')}</span>
      {g.pack?.seats.map((w) => {
        const p = picks?.[w];
        return <span key={w} className="pill">{nameAt(view, g, w)}: {p === null || p === undefined ? t('nightPackNone') : p === 'pass' ? t('nightPackPass') : nameAt(view, g, p)}</span>;
      })}
    </div>
  );
  const submitted = a.current;
  return (
    <Frame view={view} testId="night-wolf" title={title} task={t('nightWolfTask')} info={info} status={submitted === null ? t('nightChangeHint') : t('nightDone')}
      buttons={
        <>
          <Button kind="quiet" disabled={!a.canPass || submitted === 'pass'} onClick={() => session.send({ t: 'act', action: act.wolfPick('pass') })}>{t('pass')}</Button>
          <Button testId="confirm" disabled={sel === null || sel === submitted} onClick={() => sel !== null && session.send({ t: 'act', action: act.wolfPick(sel) })}>{t('confirm')}</Button>
        </>
      }
    >
      <SeatGrid view={view} g={g} enabled={a.targets} selected={sel} onSelect={setSel} tags={tags} showDead={false} />
    </Frame>
  );
}

function SeerPanel({ view, g, title }: PanelProps & { title: string }) {
  const t = useT();
  const session = useSession();
  const a = action(g, 'seer.inspect');
  const [sel, setSel] = usePick(null);
  const result = g.me!.facts.filter(isInspect).filter((f) => f.night === g.night).at(-1);
  const info = result ? (
    <p data-testid="seer-result"><strong>{t('nightSeerResult', { name: nameAt(view, g, result.target) })} {result.result === 'wolf' ? t('resultWolf') : result.result === 'notWolf' ? t('resultNotWolf') : t.role(result.result)}</strong></p>
  ) : null;
  return (
    <Frame view={view} testId="night-seer" title={title} task={a ? t('nightSeerTask') : t('nightSeerDone')} info={info} status={a ? '' : t('nightDone')}
      buttons={
        <>
          <Button kind="quiet" disabled>{t('pass')}</Button>
          <Button testId="confirm" disabled={!a || sel === null} onClick={() => sel !== null && session.send({ t: 'act', action: act.seerInspect(sel) })}>{t('confirm')}</Button>
        </>
      }
    >
      <SeatGrid view={view} g={g} enabled={a?.targets ?? []} selected={result ? result.target : sel} onSelect={a ? setSel : undefined} showDead={false} />
    </Frame>
  );
}

function GuardPanel({ view, g, title }: PanelProps & { title: string }) {
  const t = useT();
  const session = useSession();
  const a = action(g, 'guard.protect')!;
  const [sel, setSel] = usePick(a.current);
  const last = g.me!.guardLast;
  return (
    <Frame view={view} testId="night-guard" title={title} task={t('nightGuardTask')} info={last !== null ? <span className="pill">{t('nightGuardLast', { name: nameAt(view, g, last) })}</span> : null}
      status={a.current === null ? t('nightChangeHint') : t('nightDone')}
      buttons={
        <>
          <Button kind="quiet" disabled={a.current === 'pass'} onClick={() => session.send({ t: 'act', action: act.guardProtect('pass') })}>{t('pass')}</Button>
          <Button testId="confirm" disabled={sel === null || sel === a.current} onClick={() => sel !== null && session.send({ t: 'act', action: act.guardProtect(sel) })}>{t('confirm')}</Button>
        </>
      }
    >
      <SeatGrid view={view} g={g} enabled={a.targets} selected={sel} onSelect={setSel} showDead={false} />
    </Frame>
  );
}

export function WitchPanel({ view, g, title }: PanelProps & { title: string }) {
  const t = useT();
  const session = useSession();
  const heal = action(g, 'witch.heal');
  const poison = action(g, 'witch.poison');
  const victim = g.me!.facts.filter(isVictim).filter((f) => f.night === g.night).at(-1);
  const [sel, setSel] = usePick(poison?.current);
  const potions = g.me!.potions;
  const victimLine = victim ? (victim.target === null ? t('witchNoVictim') : t('witchVictim', { name: nameAt(view, g, victim.target) })) : t('witchVictimHidden');
  const info = (
    <div className="col" style={{ gap: 6 }}>
      <p><strong>{victimLine}</strong></p>
      {heal && (
        <div className="row wrap">
          <span className="hint">{t('witchHealQ')}</span>
          <Button kind={heal.current === true ? 'primary' : 'secondary'} testId="heal-yes" disabled={!heal.canUse} onClick={() => session.send({ t: 'act', action: act.witchHeal(true) })}>{t('witchHeal')}</Button>
          <Button kind={heal.current === false ? 'primary' : 'secondary'} testId="heal-no" onClick={() => session.send({ t: 'act', action: act.witchHeal(false) })}>{t('witchNoHeal')}</Button>
        </div>
      )}
      {potions && (
        <div className="potions">
          <span className={`pill ${potions.heal ? 'ok' : ''}`}>{t('potionHeal')}{potions.heal ? '' : ` · ${t('potionUsed')}`}</span>
          <span className={`pill ${potions.poison ? 'danger' : ''}`}>{t('potionPoison')}{potions.poison ? '' : ` · ${t('potionUsed')}`}</span>
        </div>
      )}
    </div>
  );
  const status = poison ? (poison.current === null ? t('witchPoisonWho') : poison.current === 'pass' ? t('nightDone') : t('witchPoisoned', { name: nameAt(view, g, poison.current) })) : t('nightDone');
  return (
    <Frame view={view} testId="night-witch" title={title} task={t('witchTask')} info={info} status={status}
      buttons={
        <>
          <Button kind="quiet" disabled={!poison || poison.current === 'pass'} onClick={() => session.send({ t: 'act', action: act.witchPoison('pass') })}>{t('pass')}</Button>
          <Button testId="confirm" disabled={!poison || sel === null || sel === poison.current} onClick={() => sel !== null && session.send({ t: 'act', action: act.witchPoison(sel) })}>{t('potionPoison')}</Button>
        </>
      }
    >
      <SeatGrid view={view} g={g} enabled={poison?.targets ?? []} selected={sel} onSelect={poison ? setSel : undefined} showDead={false} />
    </Frame>
  );
}

/** Same frame, no game effect: a private suspect/trust note kept on this device only. */
export function NotePanel({ view, g, title }: PanelProps & { title: string }) {
  const t = useT();
  const notes = useNotes(view.code);
  const [sel, setSel] = useState<Seat | null>(null);
  const tags: Record<number, { text: string; accent?: boolean }> = {};
  for (const [k, v] of Object.entries(notes)) tags[Number(k)] = { text: v === 'suspect' ? '🔍' : '🤝', accent: v === 'suspect' };
  const set = (n: Note | null) => sel !== null && notesStore.set(sel, n);
  const dead = g.me && !g.me.alive;
  return (
    <Frame view={view} testId="night-note" title={title} task={dead ? t('nightWait') : t('nightNoteTask')} info={<span className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('nightNoteHint')}</span>}
      status={sel === null ? t('nightWait') : t('nightSelected', { name: nameAt(view, g, sel) })}
      buttons={
        <>
          <Button kind="quiet" disabled={sel === null} onClick={() => set(notes[sel!] === 'trust' ? null : 'trust')}>{t('noteTrust')}</Button>
          <Button testId="confirm" disabled={sel === null} onClick={() => set(notes[sel!] === 'suspect' ? null : 'suspect')}>{t('noteSuspect')}</Button>
        </>
      }
    >
      <SeatGrid view={view} g={g} selected={sel} onSelect={setSel} tags={tags} showDead={false} />
    </Frame>
  );
}

export function HunterPanel({ view, g }: PanelProps) {
  const t = useT();
  const session = useSession();
  const step = g.step;
  if (step.kind !== 'hunter') return null;
  const a = action(g, 'hunter.shoot');
  const [sel, setSel] = usePick(a?.current);
  const mine = g.me !== null && step.pending.includes(g.me.seat);
  const names = step.pending.map((p) => nameAt(view, g, p)).join(', ');
  if (mine && a) {
    const locked = a.current !== null;
    return (
      <Frame view={view} testId="hunter-shoot" title={t('hunterTitle')} task={t('hunterYou')} info={<span className="pill danger">{t('hunterShootWho')}</span>}
        status={locked ? `${t('hunterSubmitted')} ${t('hunterIso')}` : t('hunterIso')}
        buttons={
          <>
            <Button kind="quiet" disabled={locked} onClick={() => session.send({ t: 'act', action: act.hunterShoot('pass') })}>{t('pass')}</Button>
            <Button kind="danger" testId="confirm" disabled={locked || sel === null} onClick={() => sel !== null && session.send({ t: 'act', action: act.hunterShoot(sel) })}>{t('confirm')}</Button>
          </>
        }
      >
        <SeatGrid view={view} g={g} enabled={a.targets} selected={sel} onSelect={locked ? undefined : setSel} showDead={false} />
      </Frame>
    );
  }
  return (
    <section className="card panel rise-in" data-testid="hunter-wait">
      <div className="panel-head">
        <h2 className="panel-title">{t('hunterTitle')}</h2>
        <Timer endsAt={view.phaseEndsAt} />
      </div>
      <p className="hint">{t('hunterOthers', { name: names })}</p>
      <p className="pulse">{t('hunterWaiting')}</p>
      <SeatGrid view={view} g={g} showDead />
    </section>
  );
}
