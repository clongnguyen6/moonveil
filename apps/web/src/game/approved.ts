// Adapter for approved rules whose engine signals land with rules-12. Every name the UI depends on is here, so a
// rename in the rules projection is a one-line change. Nothing is inferred: absent signal = nothing shown.
import type { GameView } from './types.ts';

/** Engine end reasons beyond the current Outcome type (rules-12). */
export type EndReason = 'noWolves' | 'parity' | 'zeroSurvivors' | 'aborted' | 'stalemate';

export function endReason(g: GameView): EndReason | null {
  return (g.outcome?.reason as EndReason | undefined) ?? null;
}

/** Stalemate warning: published by the engine at the end of a day after 2 consecutive no-death cycles.
 *  Expected public event `{ t: 'stalemateWarning', day }` (rules-12). Active until a death or the end. */
export function stalemateWarning(g: GameView): { day: number } | null {
  const log = g.publicLog as unknown as { t: string; day?: number; dead?: number[]; seat?: number; target?: number | null }[];
  let warn: { day: number } | null = null;
  for (const e of log) {
    if (e.t === 'stalemateWarning') warn = { day: e.day ?? g.day };
    else if ((e.t === 'dawn' && (e.dead?.length ?? 0) > 0) || e.t === 'executed' || (e.t === 'shot' && e.target !== null && e.target !== undefined) || e.t === 'ended') warn = null;
  }
  return warn;
}
