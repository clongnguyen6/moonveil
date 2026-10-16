// Shell entry (game-ui scope): mounts the player/moderator UI over the foundation socket client.
// The fixture engine's provisional panel stays mounted when the server runs `engine: 'fixture'` (e2e).
import { Client } from './client.ts';
import { clientSession } from './game/client-session.ts';
import { GameApp } from './ui/GameApp.tsx';
import { roomFromPath } from './ui/screens/Entry.tsx';

export const client = new Client();
// Debug/e2e handle. Holds only this seat's own data.
(globalThis as { __moonveil?: Client }).__moonveil = client;
const session = clientSession(client);

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  const code = roomFromPath();
  if (code) client.resume(code);
}

export function App() {
  boot();
  return <GameApp session={session} />;
}
