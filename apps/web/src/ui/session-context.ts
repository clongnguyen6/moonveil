import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Session, SessionState } from '../game/session.ts';

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('SessionContext missing');
  return s;
}
export function useSessionState(): SessionState {
  const s = useSession();
  return useSyncExternalStore(s.subscribe, s.getState);
}
