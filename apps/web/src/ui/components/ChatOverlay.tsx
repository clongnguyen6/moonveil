// Always-visible chat overlay in the scene corner: recent messages with sender name, avatar and channel label.
// Renders ONLY `s.chat`, which holds only channels this seat may listen to (server-filtered + client listen filter):
// no previews, badges or counts for others. Same box for every seat: size and position depend only on the host size,
// never on content or grants (fixed log height; laptop input row always reserved, live only with a speak grant).
// Sender: name and avatar both come from the one seat `msg.from` (senderOf).
// Laptop / large host: last 4 messages, inline input + History. Compact (host < 560 px wide or < 600 px tall = phones):
// one 44 px row = latest message (text: 2 lines when the host is ≥ 400 px tall, else 1) + a chat button that opens the
// sheet (history + input). The row fits in the camp frame's margin below the seat ring, so the campfire circle keeps
// its size; SceneMount reserves the box from the scene only when it is taller than that margin.
import type { SeatView } from '@moonveil/protocol';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { canSpeak, senderOf } from '../../game/select.ts';
import type { SessionState } from '../../game/session.ts';
import type { ChannelId, ChatEntry } from '../../game/types.ts';
import { useT } from '../i18n/index.ts';
import { useSession } from '../session-context.ts';
import { Avatar, Button } from './index.tsx';

const CHANNEL_LABEL: Record<ChannelId, 'chatPublic' | 'chatWolves' | 'chatGhosts'> = { public: 'chatPublic', wolves: 'chatWolves', ghosts: 'chatGhosts' };
// Host below either size → compact. Phone portrait host ≈ 390×430, phone landscape ≈ 405×390, laptop ≥ 840×720.
const COMPACT_W = 560, COMPACT_H = 600, TWO_LINES_H = 400;

/** One chat message: avatar + name (both from the sender seat, senderOf) on their own line, then the text. Shared by the
 *  overlay and the chat sheet so both read "who said what" the same way. */
export function ChatLine({ view, entry: { channel: ch, msg: m }, channelLabel, fresh }: { view: SeatView; entry: ChatEntry; channelLabel?: boolean; fresh?: boolean }) {
  const t = useT();
  const { name, player } = senderOf(view, m);
  return (
    <div className={`co-msg chat-msg ${m.from === view.me.seat ? 'mine' : ''} ${fresh ? 'fresh' : ''}`} data-testid="chat-item" data-channel={ch} data-from={m.from}>
      {player ? <Avatar p={player} size="sm" /> : <span className="avatar sm c-slate" aria-hidden="true">{name.trim().slice(0, 2).toUpperCase()}</span>}
      <span className="co-body">
        <span className="co-from from">{name}{channelLabel && <span className={`co-ch ch-${ch}`}>{t(CHANNEL_LABEL[ch])}</span>}</span>
        <span className="co-text">{m.text}</span>
      </span>
    </div>
  );
}

function useHostFit(ref: React.RefObject<HTMLElement | null>): { compact: boolean; lines: 1 | 2 } {
  const [fit, setFit] = useState<{ compact: boolean; lines: 1 | 2 }>(() => ({ compact: typeof innerWidth === 'number' && innerWidth < COMPACT_W, lines: 2 }));
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => {
      const compact = host.clientWidth < COMPACT_W || host.clientHeight < COMPACT_H, lines = host.clientHeight >= TWO_LINES_H ? 2 : 1;
      setFit((f) => (f.compact === compact && f.lines === lines ? f : { compact, lines }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [ref]);
  return fit;
}

export function ChatOverlay({ s, view, onHistory }: { s: SessionState; view: SeatView; onHistory: () => void }) {
  const t = useT();
  const session = useSession();
  const box = useRef<HTMLElement>(null);
  const { compact, lines } = useHostFit(box);
  const channels = view.voice.filter((v) => v.listen).map((v) => v.channel as ChannelId);
  const speakable = channels.filter((c) => canSpeak(view, c));
  const [channel, setChannel] = useState<ChannelId>(speakable[0] ?? channels[0] ?? 'public');
  const active: ChannelId = speakable.includes(channel) ? channel : (speakable[0] ?? channels[0] ?? 'public');
  const recent = s.chat.slice(compact ? -1 : -4);
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
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [recent.length, recent.at(-1)?.msg.id]);
  const submit = () => {
    const v = text.trim();
    if (!v || !canSpeak(view, active)) return;
    session.send({ t: 'say', channel: active, text: v });
    setText('');
  };
  const multi = channels.length > 1;
  const history = <Button kind="quiet" testId="chat-history" onClick={onHistory}>{t('chatHistory')}</Button>;
  const logEl = (
    <div className="co-log" ref={log} data-testid="chat-recent" role="log" aria-live="polite" aria-relevant="additions">
      {channels.length === 0 && <p className="co-quiet" data-testid="chat-quiet">{t('chatQuiet')}</p>}
      {channels.length > 0 && recent.length === 0 && <p className="co-quiet">{t('chatNone')}</p>}
      {recent.map((e) => <ChatLine key={e.msg.id} view={view} entry={e} channelLabel={multi || e.channel !== 'public'} fresh={flash === e.msg.id} />)}
    </div>
  );
  if (compact) {
    // Same button for every seat; the sheet holds the history and, with a speak grant, the input.
    return (
      <section ref={box} className={`chat-overlay compact lines-${lines}`} data-ui data-testid="chat-overlay" data-channels={channels.join(',')} data-compact="true" aria-label={t('chatTitle')}>
        {logEl}
        <Button kind="icon" label={t('chatOpen')} testId="chat-history" onClick={onHistory}>💬</Button>
      </section>
    );
  }
  return (
    <section ref={box} className="chat-overlay" data-ui data-testid="chat-overlay" data-channels={channels.join(',')} data-compact="false" aria-label={t('chatTitle')}>
      {logEl}
      {/* The input row is always present (same footprint for every seat); it is live only with a speak grant. */}
      {speakable.length === 0 ? (
        <div className="co-form">
          <input className="input co-input" disabled placeholder="—" tabIndex={-1} aria-hidden="true" />
          <Button kind="secondary" disabled>{t('send')}</Button>
          {history}
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
          {history}
        </form>
      )}
    </section>
  );
}
