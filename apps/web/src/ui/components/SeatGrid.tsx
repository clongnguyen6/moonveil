// Equal-cell seat grid used by EVERY night panel, votes and the shot: same size and shape for every role,
// so the screen gives no layout tell. Selection state is local until the player confirms.
import type { Seat } from '@moonveil/rules';
import { playerAt } from '../../game/select.ts';
import type { GameView, SeatId, SeatView } from '../../game/types.ts';
import { useT } from '../i18n/index.ts';
import { Avatar } from './index.tsx';

export interface SeatGridProps {
  view: SeatView;
  g: GameView;
  /** Seats that may be chosen; others render disabled. */
  enabled?: Seat[];
  selected?: Seat | null;
  onSelect?: (s: Seat) => void;
  /** Seats to list; default all. */
  seats?: Seat[];
  tags?: Partial<Record<Seat, { text: string; accent?: boolean }>>;
  speaking?: SeatId[];
  showDead?: boolean;
  testPrefix?: string;
  /** 'public' (default): tag roles only when publicly revealed or at match end. 'all': every role the view knows (moderator, end). */
  roles?: 'public' | 'all';
}

export function SeatGrid({ view, g, enabled, selected, onSelect, seats, tags, speaking, showDead = true, testPrefix = 'seat', roles = 'public' }: SeatGridProps) {
  const t = useT();
  const me = g.viewer.kind === 'seat' ? g.viewer.seat : null;
  const ended = g.step.kind === 'ended';
  const revealed = new Set(g.publicLog.filter((e) => e.t === 'roleRevealed').map((e) => (e as { seat: Seat }).seat));
  const showRole = (i: Seat) => roles === 'all' || ended || revealed.has(i);
  const list = seats ?? g.seats.map((s) => s.seat);
  const en = enabled ? new Set(enabled) : null;
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const cells = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button.seat-chip')];
    const i = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const cols = Math.max(1, Math.round(e.currentTarget.clientWidth / (cells[0]?.offsetWidth ?? 1)));
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowDown' ? i + cols : e.key === 'ArrowUp' ? i - cols : e.key === 'Home' ? 0 : cells.length - 1;
    cells[Math.max(0, Math.min(cells.length - 1, next))]?.focus();
  };
  return (
    <div className="seat-grid" role={onSelect ? 'group' : undefined} aria-label={onSelect ? t('a11yGrid') : undefined} onKeyDown={onKey}>
      {list.map((i) => {
        const sv = g.seats[i]!;
        if (!sv.alive && !showDead) return null;
        const p = playerAt(view, g, i);
        if (!p) return null;
        const can = !!onSelect && (en ? en.has(i) : sv.alive);
        const isSpeaking = speaking?.includes(p.seat) ?? false;
        const tag = tags?.[i];
        const state = `${sv.alive ? t('a11yAlive') : t('a11yDead')}${i === me ? `, ${t('a11yYou')}` : ''}${isSpeaking ? `, ${t('a11ySpeaking')}` : ''}`;
        return (
          <button
            key={i}
            type="button"
            className={`seat-chip ${sv.alive ? '' : 'dead'} ${selected === i ? 'selected' : ''}`}
            aria-pressed={onSelect ? selected === i : undefined}
            aria-label={onSelect ? t('a11yTarget', { name: p.name }) : t('a11ySeat', { name: p.name, state })}
            disabled={!!onSelect && !can}
            data-testid={`${testPrefix}-${i}`}
            onClick={() => can && onSelect?.(i)}
          >
            <Avatar p={p} dead={!sv.alive} speaking={isSpeaking} />
            <span className="meta">
              <span className="nm"><span className="nm-name">{p.name}</span>{i === me && <span className="nm-you">&nbsp;({t('you')})</span>}</span>
              {sv.role && showRole(i) && <span className={`tag team-${sv.role === 'wolf' ? 'wolves' : 'village'}`}>{t.role(sv.role)}</span>}
            </span>
            <span className="right">
              {tag && <span className={`tag ${tag.accent ? 'accent' : ''}`}>{tag.text}</span>}
              {!sv.alive && <span className="pill ghost">✝</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
