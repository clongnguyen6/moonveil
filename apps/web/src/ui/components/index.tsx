// Shared building blocks. Looks come from theme/skin.css classes; nothing here hard-codes colours.
import type { Appearance, PublicSeat } from '@moonveil/protocol';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.ts';
import { playCue } from '../audio/cues.ts';
import { serverNow } from '../../game/clock.ts';

const HAT_GLYPH: Record<Appearance['hat'], string> = { none: '', beanie: '🧢', cap: '🧢', bucket: '👒', flower: '🌼', hood: '🧥' };

export function Avatar({ p, size, dead, ghost, speaking }: { p: Pick<PublicSeat, 'name' | 'appearance'>; size?: 'lg'; dead?: boolean; ghost?: boolean; speaking?: boolean }) {
  const initials = p.name.trim().slice(0, 2).toUpperCase();
  return (
    <span className={`avatar c-${p.appearance.color} ${size ?? ''} ${dead ? 'dead' : ''} ${ghost ? 'ghost' : ''}`} aria-hidden="true">
      {initials}
      {p.appearance.hat !== 'none' && <span className="hat">{HAT_GLYPH[p.appearance.hat]}</span>}
      {speaking && <span className="speaking-ring pulse" />}
    </span>
  );
}

export function Button(props: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'icon' | 'done'; disabled?: boolean; wide?: boolean; pressed?: boolean; label?: string; testId?: string; type?: 'button' | 'submit'; haptic?: boolean }) {
  const { kind = 'primary' } = props;
  return (
    <button
      type={props.type ?? 'button'}
      className={`btn ${kind === 'primary' ? '' : kind} ${props.wide ? 'wide' : ''}`}
      disabled={props.disabled}
      aria-pressed={props.pressed}
      aria-label={props.label}
      data-testid={props.testId}
      onClick={() => {
        playCue('tap');
        if (props.haptic) navigator.vibrate?.(12);
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

/** Countdown from a server deadline. Same for every seat; shows nothing when the server gives no deadline. */
export function Timer({ endsAt, totalMs }: { endsAt: number | null; totalMs?: number | null }) {
  const t = useT();
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (endsAt === null) return null;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const total = totalMs ?? Math.max(1, endsAt - now);
  const frac = Math.max(0, Math.min(1, (endsAt - now) / total));
  const r = 12;
  const c = 2 * Math.PI * r;
  return (
    <span className={`timer ${left <= 10 ? 'low' : ''}`} role="timer" aria-live="off" aria-label={t('a11yTimer', { s: left })} data-testid="timer">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle className="track" cx="14" cy="14" r={r} />
        <circle className="ring" cx="14" cy="14" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      {left}
    </span>
  );
}

export function Sheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button, input, textarea, [tabindex]')?.focus();
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose} data-testid={testId}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <div className="sheet-head">
          <h2 className="panel-title">{title}</h2>
          <Button kind="icon" label={t('close')} onClick={onClose}>✕</Button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ text, onYes, onNo, yes, danger }: { text: string; onYes: () => void; onNo: () => void; yes: string; danger?: boolean }) {
  const t = useT();
  return (
    <div className="scrim" style={{ alignItems: 'center' }} onClick={onNo}>
      <div className="card raised panel" style={{ padding: 20, margin: 16, maxWidth: 420 }} role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        <div className="btn-row">
          <Button kind="quiet" onClick={onNo}>{t('cancel')}</Button>
          <Button kind={danger ? 'danger' : 'primary'} onClick={onYes}>{yes}</Button>
        </div>
      </div>
    </div>
  );
}

export interface ToastItem { id: number; text: string; kind?: 'ok' | 'warn' | 'danger' }
export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((x) => (
        <div key={x.id} className={`toast ${x.kind ?? ''}`}>{x.text}</div>
      ))}
    </div>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange, testId, dataKey }: { tabs: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testId?: string; dataKey?: string }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((x) => (
        <button key={x.key} role="tab" className="tab" aria-selected={value === x.key} data-testid={testId} {...(dataKey ? { [`data-${dataKey}`]: x.key } : {})} onClick={() => onChange(x.key)}>{x.label}</button>
      ))}
    </div>
  );
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(value * 100) / 100}>
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
