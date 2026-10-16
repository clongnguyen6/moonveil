// UI actor for full matches, using ONLY the game UI's documented hooks (docs/ui/SELECTORS.md, game-ui 1bff25f).
// Choices come from the seat's own wire view (me.actions), as the protocol bot does; execution goes through the DOM.
// Wire assertions are unchanged. Not exercised until the UI's real-client wiring lands in dev.
import type { GameView, Mode } from '@moonveil/protocol';
import { expect, type Player, type Table } from './index.ts';
import { type BrowserMatch, game } from './match.ts';

// Per SELECTORS.md: for many-context runs, scene off, sound off, reduced motion on.
export async function quietUi(p: Player) {
  await p.context.addInitScript(() => {
    localStorage.setItem('moonveil.ui.settings', JSON.stringify({ scene: false, sound: false, reducedMotion: 'on' }));
  });
}

export async function uiPresent(p: Player): Promise<boolean> {
  await p.page.goto('/');
  return (await p.page.getByTestId('entry').count()) > 0;
}

const tid = (p: Player, id: string) => p.page.getByTestId(id);
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

// UI action accounting: a step can close while a bot is still clicking (a missed action = pass, per rules).
// Reported by the spec so a run where UI actions mostly fail can't pass unnoticed.
// Acceptance runs (E2E_UI_STRICT=1) fail on any miss; every miss carries seat, action, step and reason.
export const uiStats = {
  attempted: 0,
  done: 0,
  misses: [] as { seat: string; action: string; step: string; reason: string }[],
  // Landed actions per type (e.g. wolf.pick) for failure reports.
  byType: {} as Record<string, number>,
};
const CLICK_MS = 1_500;
let lastReason = '';
async function tryClick(l: ReturnType<typeof tid>): Promise<boolean> {
  try {
    if ((await l.count()) === 0) {
      lastReason = 'control missing';
      return false;
    }
    await l.click({ timeout: CLICK_MS });
    return true;
  } catch (e) {
    lastReason = String((e as Error).message).split('\n').slice(0, 3).join(' | ').slice(0, 300);
    return false;
  }
}
const stepOf = (p: Player) => {
  const g = game(p) as GameView | null;
  return g ? `${g.night}/${g.day}/${g.step.kind}` : '';
};
async function act(p: Player, action: string, fn: () => Promise<boolean>) {
  uiStats.attempted++;
  lastReason = '';
  const decidedAt = stepOf(p);
  const ok = await fn();
  // A step that closed between the decision and the click is pacing, not a UI fault; still a miss in strict mode.
  if (!ok && stepOf(p) !== decidedAt) lastReason = `step closed before the action (pacing): ${lastReason}`;
  if (ok) {
    uiStats.done++;
    const type = action.split(':')[0]!;
    uiStats.byType[type] = (uiStats.byType[type] ?? 0) + 1;
  }
  else uiStats.misses.push({ seat: `${p.name}/${(game(p) as GameView | null)?.me?.seat}`, action, step: (game(p) as GameView | null)?.step.kind ?? '?', reason: lastReason || 'unknown' });
}

async function chooseSeat(p: Player, seat: number): Promise<boolean> {
  if (!(await tryClick(tid(p, `seat-${seat}`)))) return false;
  const confirm = tid(p, 'confirm');
  if ((await confirm.count()) === 0) return true; // some panels submit on selection
  if (!(await confirm.isEnabled({ timeout: CLICK_MS }).catch(() => false))) {
    lastReason = 'confirm disabled after selecting the seat';
    return false;
  }
  return tryClick(confirm);
}

// One random legal choice per available action, performed through the UI.
export async function uiBotAct(p: Player, r: () => number): Promise<number> {
  const me = (game(p) as GameView | null)?.me;
  if (!me || p.view().status !== 'playing') return 0;
  let n = 0;
  for (const a of me.actions) {
    switch (a.type) {
      case 'wolf.pick':
      case 'guard.protect':
      case 'seer.inspect':
      case 'hunter.shoot':
      case 'witch.poison':
        if (a.targets.length && r() < (a.type === 'witch.poison' ? 0.3 : 0.85)) {
          const t = pick(r, a.targets);
          await act(p, `${a.type}:${t}`, () => chooseSeat(p, t));
          n++;
        }
        break;
      case 'witch.heal':
        if (a.canUse) {
          const id = r() < 0.5 ? 'heal-yes' : 'heal-no';
          await act(p, `${a.type}:${id}`, () => tryClick(tid(p, id)));
          n++;
        }
        break;
      case 'vote.nominate':
        if (a.targets.length && r() < 0.8) {
          const t = pick(r, a.targets);
          await act(p, `${a.type}:${t}`, () => chooseSeat(p, t));
        } else await act(p, 'vote.nominate:skip', () => tryClick(tid(p, 'vote-skip')));
        n++;
        break;
      case 'vote.confirm':
        {
          const id = r() < 0.6 ? 'vote-yes' : 'vote-no';
          await act(p, `${a.type}:${id}`, () => tryClick(tid(p, id)));
        }
        n++;
        break;
    }
  }
  return n;
}

// Moderator closes the step through the console (2nd button of the confirm dialog = confirm).
export async function uiCloseStep(mod: Player) {
  await tid(mod, 'close-step').click();
  await mod.page.locator('[role=alertdialog] .btn').nth(1).click();
  uiStats.attempted++;
  uiStats.done++;
}

export async function seatRealMatchUi(table: Table, opts: { mode: Mode; seats: number; baseURL: string }): Promise<BrowserMatch> {
  const ctx = { baseURL: opts.baseURL };
  const host = await table.player(opts.mode === 'moderator' ? 'Mod' : 'P0', ctx);
  await quietUi(host);
  await host.page.goto('/');
  await tid(host, 'name').fill(host.name);
  await tid(host, `create-${opts.mode}`).click();
  await expect(tid(host, 'room')).toHaveAttribute('data-status', 'lobby');
  const code = host.view().code;
  const players: Player[] = opts.mode === 'automatic' ? [host] : [];
  while (players.length < opts.seats) {
    const p = await table.player(`P${players.length}`, ctx);
    await quietUi(p);
    await p.page.goto('/');
    await tid(p, 'name').fill(p.name);
    await tid(p, 'code').fill(code);
    await tid(p, 'join').click();
    await expect(tid(p, 'room')).toHaveAttribute('data-status', 'lobby');
    players.push(p);
  }
  for (const p of players) await tid(p, 'ready').click();
  await expect.poll(() => host.view().canStart).toBe(true);
  await tid(host, 'start').click();
  for (const p of [host, ...players]) await expect(tid(p, 'room')).toHaveAttribute('data-status', 'playing');
  return { mode: opts.mode, moderator: opts.mode === 'moderator' ? host : null, players, driver: host, steps: 0 };
}
