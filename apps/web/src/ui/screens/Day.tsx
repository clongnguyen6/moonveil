// Day panels. Approved: votes run to fixed deadlines; a voter sees only their own ballot; results come from
// the public log at close. No live tallies or "x of y voted" counters anywhere.
import type { Seat } from '@moonveil/rules';
import { useEffect, useState } from 'react';
import { act } from '../../game/commands.ts';
import { useNotes } from '../../game/local-store.ts';
import { action, aliveSeats, nameAt } from '../../game/select.ts';
import type { GameView, SeatId, SeatView } from '../../game/types.ts';
import { Button, Timer } from '../components/index.tsx';
import { SeatGrid } from '../components/SeatGrid.tsx';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';

interface P { view: SeatView; g: GameView; speaking: SeatId[] }

function Head({ title, view, right }: { title: string; view: SeatView; right?: React.ReactNode }) {
  return (
    <div className="panel-head">
      <h2 className="panel-title">{title}</h2>
      <span className="row">{right}<Timer endsAt={view.phaseEndsAt} /></span>
    </div>
  );
}

function noteTags(notes: Record<number, 'suspect' | 'trust'>) {
  const tags: Record<number, { text: string; accent?: boolean }> = {};
  for (const [k, v] of Object.entries(notes)) tags[Number(k)] = { text: v === 'suspect' ? '🔍' : '🤝', accent: v === 'suspect' };
  return tags;
}

export function DiscussionPanel({ view, g, speaking }: P) {
  const t = useT();
  const notes = useNotes(view.code);
  const living = aliveSeats(g).length;
  return (
    <section className="card panel rise-in" data-testid="day-discussion">
      <Head title={t('discussTitle')} view={view} right={<span className="pill">{t('livingCount', { n: living })}</span>} />
      <p className="hint">{t('discussHint')}</p>
      <SeatGrid view={view} g={g} speaking={speaking} tags={noteTags(notes)} />
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{view.phaseEndsAt !== null ? t('discussCountdown') : ''}</p>
    </section>
  );
}

export function VotePanel({ view, g, speaking }: P) {
  const t = useT();
  const session = useSession();
  const a = action(g, 'vote.nominate');
  const notes = useNotes(view.code);
  const [sel, setSel] = useState<Seat | null>(typeof a?.current === 'number' ? a.current : null);
  useEffect(() => {
    if (typeof a?.current === 'number') setSel(a.current);
  }, [a?.current]);
  const cur = a?.current ?? null;
  const yours = cur === null ? t('voteNone') : cur === 'skip' ? t('voteYoursSkip') : t('voteYours', { name: nameAt(view, g, cur) });
  return (
    <section className="card panel rise-in" data-testid="day-vote">
      <Head title={t('voteTitle')} view={view} />
      <p className="hint">{t('voteHint')}</p>
      <SeatGrid view={view} g={g} enabled={a?.targets ?? []} selected={sel} onSelect={a ? setSel : undefined} speaking={speaking} tags={noteTags(notes)} showDead={false} />
      <div className="btn-row">
        <Button kind="quiet" testId="vote-skip" disabled={!a || cur === 'skip'} onClick={() => session.send({ t: 'act', action: act.nominate('skip') })}>{t('skip')}</Button>
        <Button testId="confirm" disabled={!a || sel === null || sel === cur} onClick={() => sel !== null && session.send({ t: 'act', action: act.nominate(sel) })}>{t('confirm')}</Button>
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }} aria-live="polite" data-testid="my-vote">{a ? yours : t('confirmDead')} · {t('voteCloses')}</p>
    </section>
  );
}

export function DefensePanel({ view, g, speaking }: P) {
  const t = useT();
  if (g.step.kind !== 'day.defense') return null;
  const accused = g.step.accused;
  const mine = g.me?.seat === accused;
  const name = nameAt(view, g, accused);
  return (
    <section className="card panel rise-in" data-testid="day-defense">
      <Head title={t('defenseTitle', { name })} view={view} />
      <p className="hint">{mine ? t('defenseAccused') : t('defenseOthers', { name })}</p>
      <SeatGrid view={view} g={g} seats={[accused]} speaking={speaking} />
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{t('defenseNext')}</p>
    </section>
  );
}

export function ConfirmPanel({ view, g }: P) {
  const t = useT();
  const session = useSession();
  if (g.step.kind !== 'day.confirm') return null;
  const a = action(g, 'vote.confirm');
  const name = nameAt(view, g, g.step.accused);
  const cur = a?.current ?? null;
  const living = aliveSeats(g).length;
  return (
    <section className="card panel rise-in" data-testid="day-confirm">
      <Head title={t('confirmTitle', { name })} view={view} right={<span className="pill">{t('livingCount', { n: living })}</span>} />
      <p className="hint">{t('confirmHint')}</p>
      <SeatGrid view={view} g={g} seats={[g.step.accused]} />
      <div className="btn-row" style={{ minHeight: 64 }}>
        <Button kind={cur === 'no' ? 'secondary' : 'quiet'} testId="vote-no" disabled={!a} pressed={cur === 'no'} onClick={() => session.send({ t: 'act', action: act.confirm('no') })}>{t('confirmNo')}</Button>
        <Button kind={cur === 'yes' ? 'danger' : 'primary'} testId="vote-yes" disabled={!a} pressed={cur === 'yes'} onClick={() => session.send({ t: 'act', action: act.confirm('yes') })}>{t('confirmYes')}</Button>
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }} aria-live="polite" data-testid="my-ballot">
        {a ? (cur === null ? t('confirmNone') : t('confirmYours', { choice: cur === 'yes' ? t('confirmYes') : t('confirmNo') })) : t('confirmDead')} · {t('voteCloses')}
      </p>
    </section>
  );
}
