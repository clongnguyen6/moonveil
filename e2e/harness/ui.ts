// UI actor for full matches, using ONLY the game UI's documented hooks (docs/ui/SELECTORS.md, game-ui 1bff25f).
// Choices come from the seat's own wire view (me.actions), as the protocol bot does; execution goes through the DOM.
// Wire assertions are unchanged. Not exercised until the UI's real-client wiring lands in dev.
import type { GameView, Mode } from '@moonveil/protocol';
import { planActions } from '../../apps/server/test/bot-policy.ts';
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

// UI action accounting: a step can close while a bot is still clicking (a missed action = pass, per rules).
// Reported by the spec so a run where UI actions mostly fail can't pass unnoticed.
// Acceptance runs (E2E_UI_STRICT=1) fail on any miss; every miss carries seat, action, step and reason.
export const uiStats = {
  attempted: 0,
  done: 0,
  misses: [] as { seat: string; action: string; step: string; reason: string }[],
  // Landed actions per type (e.g. wolf.pick) for failure reports.
  byType: {} as Record<string, number>,
  // Engine-accepted wolf picks, checked against the end-of-match night records.
  wolfPicks: [] as { night: number; seat: number; target: number }[],
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
// "Landed" = the engine accepted it: the seat's own wire view must show the effect (not just a DOM click).
function reflected(p: Player, action: string): boolean {
  const g = game(p) as GameView | null;
  const me = g?.me;
  if (!g || !me) return false;
  const [type, raw] = action.split(':') as [string, string];
  const val: unknown = /^\d+$/.test(raw) ? Number(raw) : raw === 'heal-yes' ? true : raw === 'heal-no' ? false : raw === 'vote-yes' ? 'yes' : raw === 'vote-no' ? 'no' : raw;
  const cur = (me.actions.find((a) => a.type === type) as { current?: unknown } | undefined)?.current;
  switch (type) {
    case 'wolf.pick':
      return (g.pack?.picks?.[me.seat] ?? cur) === val;
    case 'guard.protect':
    case 'witch.poison':
    case 'witch.heal':
      return cur === val;
    case 'hunter.shoot':
      return cur === val || g.publicLog.some((e) => e.t === 'shot' && (e as { by?: number }).by === me.seat);
    case 'seer.inspect':
      return me.facts.some((f) => f.k === 'inspect' && (f as { target?: number }).target === val);
    case 'vote.nominate':
    case 'vote.confirm':
      return (me as { ballot?: unknown }).ballot === val;
    default:
      return true;
  }
}
async function engineAccepted(p: Player, action: string, framesBefore: number): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    if (reflected(p, action)) return true;
    await p.page.waitForTimeout(100);
  }
  const err = p.frames.slice(framesBefore).filter((f) => f.msg.t === 'error').at(-1);
  lastReason = err ? `server rejected: ${(err.msg as { message?: string }).message}` : 'click landed but the engine state does not show it';
  return false;
}

async function act(p: Player, action: string, fn: () => Promise<boolean>) {
  uiStats.attempted++;
  lastReason = '';
  const decidedAt = stepOf(p);
  const framesBefore = p.frames.length;
  const ok = (await fn()) && (await engineAccepted(p, action, framesBefore));
  // A step that closed between the decision and the click is pacing, not a UI fault; still a miss in strict mode.
  if (!ok && stepOf(p) !== decidedAt) lastReason = `step closed before the action (pacing): ${lastReason}`;
  if (ok) {
    uiStats.done++;
    const type = action.split(':')[0]!;
    uiStats.byType[type] = (uiStats.byType[type] ?? 0) + 1;
    const g = game(p) as GameView | null;
    if (type === 'wolf.pick' && g?.me) uiStats.wolfPicks.push({ night: g.night, seat: g.me.seat, target: Number(action.split(':')[1]) });
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

// Shared bot policy (apps/server/test/bot-policy.ts), performed through the UI hooks of docs/ui/SELECTORS.md.
export async function uiBotAct(p: Player, r: () => number): Promise<number> {
  if (p.view().status !== 'playing') return 0;
  const plans = planActions(game(p) as GameView | null, r);
  for (const plan of plans) {
    switch (plan.type) {
      case 'witch.heal': {
        const id = plan.value ? 'heal-yes' : 'heal-no';
        await act(p, `${plan.type}:${id}`, () => tryClick(tid(p, id)));
        break;
      }
      case 'vote.confirm': {
        const id = plan.value === 'yes' ? 'vote-yes' : 'vote-no';
        await act(p, `${plan.type}:${id}`, () => tryClick(tid(p, id)));
        break;
      }
      case 'vote.nominate':
        if (plan.value === 'skip') await act(p, 'vote.nominate:skip', () => tryClick(tid(p, 'vote-skip')));
        else await act(p, `${plan.type}:${plan.value}`, () => chooseSeat(p, plan.value as number));
        break;
      default:
        await act(p, `${plan.type}:${plan.value}`, () => chooseSeat(p, plan.value as number));
    }
  }
  return plans.length;
}

// Moderator closes the step through the console (2nd button of the confirm dialog = confirm).
export async function uiCloseStep(mod: Player) {
  await tid(mod, 'close-step').click();
  await mod.page.locator('[role=alertdialog] .btn').nth(1).click();
  uiStats.attempted++;
  uiStats.done++;
}

export async function seatRealMatchUi(table: Table, opts: { mode: Mode; seats: number; baseURL: string; hostName?: string }): Promise<BrowserMatch> {
  const ctx = { baseURL: opts.baseURL };
  const host = await table.player(opts.hostName ?? (opts.mode === 'moderator' ? 'Mod' : 'P0'), ctx);
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
