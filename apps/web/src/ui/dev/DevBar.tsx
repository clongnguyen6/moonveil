// Dev-only bar: switch viewer seat (roles shown here come from the stub's full state, never from a seat view).
import { useSyncExternalStore } from 'react';
import type { LocalRoom } from '../../game/stub/local-room.ts';
import { SCENARIOS } from '../../game/stub/scenarios.ts';

const R: Record<string, string> = { wolf: 'W', villager: 'V', seer: 'S', guard: 'G', witch: 'Wi', hunter: 'H' };

export function DevBar({ room }: { room: LocalRoom }) {
  useSyncExternalStore(room.subscribe, room.getState);
  const roles = room.devRoles();
  const q = new URLSearchParams(location.search);
  const go = (k: string, v: string) => {
    q.set(k, v);
    location.search = q.toString();
  };
  const step = room.game?.match.step.kind ?? room.status;
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: '#000c', color: '#fff', font: '12px/1.3 monospace', padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }} data-testid="devbar">
      <span>STUB · {step}</span>
      <select value={q.get('scenario') ?? 'lobby'} onChange={(e) => go('scenario', e.target.value)} style={{ font: 'inherit' }}>
        {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={q.get('lang') ?? ''} onChange={(e) => go('lang', e.target.value)} style={{ font: 'inherit' }}>
        <option value="">lang</option><option value="vi">vi</option><option value="en">en</option>
      </select>
      {room.allSeats().map((s) => (
        <button key={s.id} onClick={() => room.setViewer(s.id)} style={{ font: 'inherit', padding: '2px 6px', background: room.viewer === s.id ? '#f2a65a' : '#333', color: room.viewer === s.id ? '#000' : '#fff', border: 0, borderRadius: 4 }}>
          {s.kind === 'moderator' ? 'MOD' : s.name}{roles[s.id] ? `:${R[roles[s.id]!]}` : ''}
        </button>
      ))}
      <button style={{ font: 'inherit' }} onClick={() => room.botsAct()}>bots act</button>
      <button style={{ font: 'inherit' }} onClick={() => room.closeStep()}>close step</button>
      <button style={{ font: 'inherit' }} onClick={() => room.simulateReconnect()}>reconnect</button>
      <button style={{ font: 'inherit' }} onClick={() => { room.speed = room.speed ? 0 : 1; room.closeStep(); }}>speed:{room.speed}</button>
      <button style={{ font: 'inherit' }} onClick={() => go('live', q.get('live') === '1' ? '0' : '1')}>live:{q.get('live') === '1' ? 'on' : 'off'}</button>
    </div>
  );
}
