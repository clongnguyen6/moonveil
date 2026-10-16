// Command shapes the UI sends. Player commands are Commands without `seat` (host.ts injects it).
// Keep every engine-facing string here so a rules API change touches one file.
import type { Seat } from '@moonveil/rules';

export const act = {
  wolfPick: (target: Seat | 'pass') => ({ type: 'wolf.pick', target }),
  seerInspect: (target: Seat) => ({ type: 'seer.inspect', target }),
  guardProtect: (target: Seat | 'pass') => ({ type: 'guard.protect', target }),
  witchHeal: (use: boolean) => ({ type: 'witch.heal', use }),
  witchPoison: (target: Seat | 'pass') => ({ type: 'witch.poison', target }),
  nominate: (target: Seat | 'skip' | null) => ({ type: 'vote.nominate', target }),
  confirm: (choice: 'yes' | 'no' | null) => ({ type: 'vote.confirm', choice }),
  hunterShoot: (target: Seat | 'pass') => ({ type: 'hunter.shoot', target }),
};

/** Moderator commands (engine `moderate`). Sent as `{ t: 'act', action }` from the moderator seat (foundation-3). */
export const mod = {
  forSeat: (seat: Seat, a: Record<string, unknown>) => ({ ...a, seat }),
  wolfDecide: (target: Seat | 'pass') => ({ type: 'wolf.decide', target }),
  closeStep: () => ({ type: 'step.close' }),
  /** PROVISIONAL (not approved): shown only when the engine config enables them (see Moderator.tsx). */
  remove: (seat: Seat) => ({ type: 'player.remove', seat }),
  abort: () => ({ type: 'match.abort' }),
  /** APPROVED Q16 (2026-10-16): the moderator enters the Yes count of a show of hands; the engine applies Yes*2 > living. */
  yesCount: (yes: number) => ({ type: 'day.confirmCount', yes }),
};
