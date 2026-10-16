// DEV ENTRY: UI against the in-browser rules stub. Not shipped. Served by vite at /src/ui/dev/index.html.
//   ?scenario=<name>  ?lang=vi|en  ?bar=0 (hide dev bar)  ?live=1 (real-time timers + bots)  ?mode=moderator
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { settingsStore } from '../../game/local-store.ts';
import { SCENARIOS, type ScenarioName, makeRoom, scenario } from '../../game/stub/scenarios.ts';
import { GameApp } from '../GameApp.tsx';
import '../layout.css';
import { DevBar } from './DevBar.tsx';

const q = new URLSearchParams(location.search);
const lang = q.get('lang');
if (lang === 'vi' || lang === 'en') settingsStore.set({ lang });
if (q.get('sound') === '0') settingsStore.set({ sound: false });
const live = q.get('live') === '1';
const name = (q.get('scenario') ?? 'lobby') as ScenarioName;
const room = SCENARIOS.includes(name) ? scenario(name, live ? { speed: 1, autoBots: true } : {}) : makeRoom(q.get('mode') === 'moderator' ? 'moderator' : 'automatic', { speed: 1, autoBots: true });
(globalThis as { __stub?: unknown }).__stub = room;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameApp session={room}>{q.get('bar') !== '0' && <DevBar room={room} />}</GameApp>
  </StrictMode>,
);
