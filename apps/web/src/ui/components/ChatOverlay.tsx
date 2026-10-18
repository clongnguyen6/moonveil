// Always-visible chat overlay in the scene corner: recent messages with sender name, appearance accent and channel
// label; input when the seat may speak; "history" opens the full sheet. Renders ONLY `s.chat`, which holds only
// channels this seat may listen to (server-filtered + client listen filter): no previews, badges or counts for others.
// The box exists for every seat in the same place and size, so its presence is not a tell; only its content is private.
import type { SeatView } from '@moonveil/protocol';
import { useEffect, useRef, useState } from 'react';
import { canSpeak, nameOf } from '../../game/select.ts';
import type { SessionState } from '../../game/session.ts';
import type { ChannelId } from '../../game/types.ts';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import { Avatar, Button } from './index.tsx';

const CHANNEL_LABEL: Record<ChannelId, 'chatPublic' | 'chatWolves' | 'chatGhosts'> = { public: 'chatPublic', wolves: 'chatWolves', ghosts: 'chatGhosts' };

export function ChatOverlay({ s, view, onHistory, max }: { s: SessionState; view: SeatView; onHistory: () => void; max?: number }) {
  const compact = typeof matchMedia === 'function' && matchMedia('(max-width: 520px)').matches;
  const limit = max ?? (compact ? 2 : 4);
  const t = useT();
  const session = useSession();
  const channels = view.voice.filter((v) => v.listen).map((v) => v.channel as ChannelId);
  const speakable = channels.filter((c) => canSpeak(view, c));
  const [channel, setChannel] = useState<ChannelId>(speakable[0] ?? channels[0] ?? 'public');
  const active: ChannelId = speakable.includes(channel) ? channel : (speakable[0] ?? channels[0] ?? 'public');
  const recent = s.chat.slice(-limit);
  const [text, setText] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const lastId = useRef<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  // New message: brief highlight + scroll into view (no sound by default; see FLOW.md).
  useEffect(() => {
    const last = s.chat.at(-1);
    if (!last || last.msg.id === lastId.current) return;
    const first = lastId.current === null;
    lastId.current = last.msg.id;
    if (!first) { setFlash(last.msg.id); const id = setTimeout(() => setFlash(null), 2500); return () => clearTimeout(id); }
  }, [s.chat]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [recent.length]);
  const submit = () => {
    const v = text.trim();
    if (!v || !canSpeak(view, active)) return;
    session.send({ t: 'say', channel: active, text: v });
    setText('');
  };
  const player = (id: string) => view.players.find((p) => p.seat === id);
  const multi = channels.length > 1;
  return (
    <section className={`chat-overlay ${compact ? 'compact' : ''}`} data-ui data-testid="chat-overlay" data-channels={channels.join(',')} aria-label={t('chatTitle')}>
      <div className="co-head">
        <span className="co-title">{t('chatTitle')}</span>
        <Button kind="quiet" testId="chat-history" onClick={onHistory}>{t('chatHistory')}</Button>
      </div>
      <div className="co-log" ref={log} data-testid="chat-recent" role="log" aria-live="polite" aria-relevant="additions">
        {channels.length === 0 && <p className="co-quiet" data-testid="chat-quiet">{t('chatQuiet')}</p>}
        {channels.length > 0 && recent.length === 0 && <p className="co-quiet">{t('chatNone')}</p>}
        {recent.map(({ channel: ch, msg: m }) => {
          const p = player(m.from);
          return (
            <div key={m.id} className={`co-msg ${m.from === view.me.seat ? 'mine' : ''} ${flash === m.id ? 'fresh' : ''}`} data-testid="chat-item" data-channel={ch}>
              {p ? <Avatar p={p} size="sm" /> : <span className="avatar sm c-slate" aria-hidden="true">M</span>}
              <span className="co-body">
                <span className="co-from">{m.name ?? nameOf(view, m.from)}{(multi || ch !== 'public') && <span className={`co-ch ch-${ch}`}>{t(CHANNEL_LABEL[ch])}</span>}</span>
                <span className="co-text">{m.text}</span>
              </span>
            </div>
          );
        })}
      </div>
      {/* The input row is always present (same footprint for every seat); it is live only with a speak grant. */}
      {speakable.length === 0 ? (
        <div className="co-form" aria-hidden="true">
          <input className="input co-input" disabled placeholder="—" tabIndex={-1} />
          <Button kind="secondary" disabled>{t('send')}</Button>
        </div>
      ) : (
        <form className="co-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {speakable.length > 1 && (
            <select className="input co-select" value={active} aria-label={t('voiceChannel')} data-testid="chat-overlay-channel" onChange={(e) => setChannel(e.target.value as ChannelId)}>
              {speakable.map((c) => <option key={c} value={c}>{t(CHANNEL_LABEL[c])}</option>)}
            </select>
          )}
          <input className="input co-input" value={text} maxLength={500} placeholder={`${t('chatPh')} (${t(CHANNEL_LABEL[active])})`} aria-label={t('chatPh')} data-testid="chat-overlay-input" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} />
          <Button type="submit" testId="chat-overlay-send" disabled={!text.trim()}>{t('send')}</Button>
        </form>
      )}
    </section>
  );
}
