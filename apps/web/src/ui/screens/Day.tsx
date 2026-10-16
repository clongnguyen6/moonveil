// Day panels. APPROVED (2026-10-16, superseding the earlier "own ballot only"): day votes are open ballots,
// live: each voter's target / Skip, and each Yes / No, as they vote, with counts. Rendered strictly from the
// projection (`step.votes`, `step.voted`): when the engine gives `votes`, per-voter choices show; when it gives
// only `voted`, who-has-voted shows; otherwise only the own ballot. Deadlines are fixed; nothing closes early.
import type { Seat } from '@moonveil/rules';
import { useEffect, useState } from 'react';
import { act } from '../../game/commands.ts';
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

/** Per-seat tags from the live ballots: the voter's choice, or a "voted" mark when only that is public. */
function ballotTags(view: SeatView, g: GameView, votes: (Seat | 'skip' | 'yes' | 'no' | null)[] | null, voted: boolean[] | null, t: ReturnType<typeof useT>) {
  const tags: Record<number, { text: string; accent?: boolean }> = {};
  if (votes) {
    votes.forEach((v, voter) => {
      if (v === null) return;
      tags[voter] = { text: v === 'skip' ? t('skip') : v === 'yes' ? t('confirmYes') : v === 'no' ? t('confirmNo') : `→ ${nameAt(view, g, v)}`, accent: v === 'yes' };
    });
  } else if (voted) {
    voted.forEach((did, voter) => { if (did) tags[voter] = { text: '✓' }; });
  }
  return tags;
}

export function DiscussionPanel({ view, g, speaking }: P) {
  const t = useT();
  const living = aliveSeats(g).length;
  return (
    <section className="card panel rise-in" data-testid="day-discussion">
      <Head title={t('discussTitle')} view={view} right={<span className="pill">{t('livingCount', { n: living })}</span>} />
      <p className="hint">{t('discussHint')}</p>
      <SeatGrid view={view} g={g} speaking={speaking} />
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }}>{view.phaseEndsAt !== null ? t('discussCountdown') : ''}</p>
    </section>
  );
}

export function VotePanel({ view, g, speaking }: P) {
  const t = useT();
  const session = useSession();
  if (g.step.kind !== 'day.vote') return null;
  const a = action(g, 'vote.nominate');
  const [sel, setSel] = useState<Seat | null>(typeof a?.current === 'number' ? a.current : null);
  useEffect(() => {
    if (typeof a?.current === 'number') setSel(a.current);
  }, [a?.current]);
  const cur = (g.me?.ballot as Seat | 'skip' | null | undefined) ?? a?.current ?? null;
  const yours = cur === null ? t('voteNone') : cur === 'skip' ? t('voteYoursSkip') : t('voteYours', { name: nameAt(view, g, cur) });
  const votes = g.step.votes;
  const tally = new Map<Seat | 'skip', number>();
  votes?.forEach((v) => v !== null && tally.set(v, (tally.get(v) ?? 0) + 1));
  const votedCount = votes ? votes.filter((v) => v !== null).length : g.step.voted ? g.step.voted.filter(Boolean).length : null;
  const targetTags: Record<number, { text: string; accent?: boolean }> = {};
  for (const [k, n] of tally) if (k !== 'skip') targetTags[k] = { text: `${n} ${t('votesShort')}`, accent: true };
  return (
    <section className="card panel rise-in" data-testid="day-vote">
      <Head title={t('voteTitle')} view={view} right={votedCount !== null ? <span className="pill" data-testid="voted-count">{t('votedCount', { n: votedCount, total: aliveSeats(g).length })}</span> : null} />
      <p className="hint">{t('voteHint')}</p>
      <SeatGrid view={view} g={g} enabled={a?.targets ?? []} selected={sel} onSelect={a ? setSel : undefined} speaking={speaking} tags={targetTags} showDead={false} />
      {(votes || g.step.voted) && (
        <ul className="ballots" data-testid="ballots">
          {(votes ?? g.step.voted!).map((v, voter) => {
            const sv = g.seats[voter];
            if (!sv?.alive) return null;
            const text = votes ? (v === null ? '…' : v === 'skip' ? t('skip') : nameAt(view, g, v as Seat)) : (v ? '✓' : '…');
            return <li key={voter} className={v === null || v === false ? 'muted' : ''}><span>{nameAt(view, g, voter)}</span><span>{text}</span></li>;
          })}
          {tally.has('skip') && <li><span>{t('skip')}</span><span>{tally.get('skip')}</span></li>}
        </ul>
      )}
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
  const cur = (g.me?.ballot as 'yes' | 'no' | null | undefined) ?? a?.current ?? null;
  const living = aliveSeats(g).length;
  const votes = g.step.votes;
  const yes = votes?.filter((v) => v === 'yes').length ?? null;
  const no = votes?.filter((v) => v === 'no').length ?? null;
  const tags = ballotTags(view, g, votes, g.step.voted, t);
  return (
    <section className="card panel rise-in" data-testid="day-confirm">
      <Head title={t('confirmTitle', { name })} view={view} right={<span className="pill">{t('livingCount', { n: living })}</span>} />
      <p className="hint">{t('confirmHint')}</p>
      {yes !== null && no !== null && <p data-testid="confirm-tally"><strong>{t('confirmResult', { yes, no })}</strong></p>}
      <SeatGrid view={view} g={g} tags={tags} showDead={false} />
      <div className="btn-row" style={{ minHeight: 64 }}>
        <Button kind={cur === 'no' ? 'primary' : 'secondary'} testId="vote-no" disabled={!a} pressed={cur === 'no'} onClick={() => session.send({ t: 'act', action: act.confirm('no') })}>{t('confirmNo')}</Button>
        <Button kind={cur === 'yes' ? 'danger' : 'secondary'} testId="vote-yes" disabled={!a} pressed={cur === 'yes'} onClick={() => session.send({ t: 'act', action: act.confirm('yes') })}>{t('confirmYes')}</Button>
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-0)' }} aria-live="polite" data-testid="my-ballot">
        {a ? (cur === null ? t('confirmNone') : t('confirmYours', { choice: cur === 'yes' ? t('confirmYes') : t('confirmNo') })) : t('confirmDead')} · {t('voteCloses')}
      </p>
    </section>
  );
}
