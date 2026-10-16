// Reusable multi-session e2e harness. Each Player = own BrowserContext (isolated storage = own device).
// Every WebSocket frame a player's page receives is captured raw, so tests assert on the wire, not the UI.
//   import { test, expect } from '../harness/index.ts';
//   test('x', async ({ table }) => { const host = await table.player('Ann'); ... });
import { type Browser, type BrowserContext, type BrowserContextOptions, expect, type Page, test as base } from '@playwright/test';
import type { Appearance, Mode, SeatView, ServerMessage } from '@moonveil/protocol';

export interface Frame {
  at: number;
  raw: string;
  msg: ServerMessage;
}

export class Player {
  readonly name: string;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly frames: Frame[] = [];

  constructor(name: string, context: BrowserContext, page: Page) {
    this.name = name;
    this.context = context;
    this.page = page;
    page.on('websocket', (ws) => {
      ws.on('framereceived', ({ payload }) => {
        const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
        this.frames.push({ at: Date.now(), raw, msg: JSON.parse(raw) as ServerMessage });
      });
    });
  }

  // Latest snapshot received on the wire.
  view(): SeatView {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const m = this.frames[i]!.msg;
      if (m.t === 'state') return m.view;
    }
    throw new Error(`${this.name}: no state frame yet`);
  }
  get seat(): string {
    return this.view().me.seat;
  }
  // Frames that carry data (excludes heartbeats), optionally after a mark.
  dataFrames(since = 0): Frame[] {
    return this.frames.slice(since).filter((f) => f.msg.t !== 'hb');
  }
  wire(): string {
    return this.frames.map((f) => f.raw).join('\n');
  }
  mark(): number {
    return this.frames.length;
  }

  async fillProfile(name = this.name, appearance?: Partial<Appearance>) {
    await this.page.getByTestId('name').fill(name);
    if (appearance?.color) await this.page.getByTestId(`color-${appearance.color}`).click();
    if (appearance?.hat) await this.page.getByTestId('hat').selectOption(appearance.hat);
  }
  async createRoom(mode: Mode, appearance?: Partial<Appearance>): Promise<string> {
    await this.page.goto('/');
    await this.fillProfile(this.name, appearance);
    await this.page.getByTestId(`create-${mode}`).click();
    await expect(this.page.getByTestId('room')).toBeVisible();
    return (await this.page.getByTestId('room-code').textContent())!.trim();
  }
  async joinByLink(code: string, appearance?: Partial<Appearance>) {
    await this.page.goto(`/r/${code}`);
    await this.fillProfile(this.name, appearance);
    await this.page.getByTestId('join').click();
    await expect(this.page.getByTestId('room')).toBeVisible();
  }
  async joinByCode(code: string, appearance?: Partial<Appearance>) {
    await this.page.goto('/');
    await this.fillProfile(this.name, appearance);
    await this.page.getByTestId('code').fill(code);
    await this.page.getByTestId('join').click();
    await expect(this.page.getByTestId('room')).toBeVisible();
  }
  async ready() {
    await this.page.getByTestId('ready').click();
    await expect.poll(() => this.view().players.find((p) => p.seat === this.seat)?.ready).toBe(true);
  }
  async waitConnected() {
    await expect(this.page.locator('[data-testid=conn][data-status=open]')).toBeVisible();
  }
  // Simulated network drop: closes the socket like a dead link; the app must resume on its own.
  async dropNetwork(ms = 1500) {
    await this.context.setOffline(true);
    await this.page.evaluate(() => (globalThis as any).__moonveil?.['ws']?.close());
    await this.page.waitForTimeout(ms);
    await this.context.setOffline(false);
  }
}

export class Table {
  readonly players: Player[] = [];
  private browser: Browser;
  private contextOptions: BrowserContextOptions;

  constructor(browser: Browser, contextOptions: BrowserContextOptions) {
    this.browser = browser;
    this.contextOptions = contextOptions;
  }

  async player(name: string, opts: BrowserContextOptions = {}): Promise<Player> {
    const context = await this.browser.newContext({ ...this.contextOptions, ...opts });
    const page = await context.newPage();
    const p = new Player(name, context, page);
    this.players.push(p);
    return p;
  }

  // Host creates; others join (alternating link/code); all players ready. Returns room code.
  async seat(mode: Mode, host: Player, others: Player[]): Promise<string> {
    const code = await host.createRoom(mode);
    for (const [i, p] of others.entries()) {
      if (i % 2) await p.joinByCode(code);
      else await p.joinByLink(code);
    }
    const players = mode === 'automatic' ? [host, ...others] : others;
    for (const p of players) await p.ready();
    await expect.poll(() => host.view().canStart).toBe(true);
    return code;
  }

  async close() {
    await Promise.all(this.players.map((p) => p.context.close()));
  }
}

export const test = base.extend<{ table: Table }>({
  // Built-in fixtures carry project/device options; compose them for every extra context.
  table: async ({ browser, contextOptions, baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale }, use) => {
    const t = new Table(browser, {
      ...contextOptions,
      ...(baseURL ? { baseURL } : {}),
      ...(viewport !== undefined ? { viewport } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(locale ? { locale } : {}),
      isMobile,
      hasTouch,
      deviceScaleFactor,
    });
    await use(t);
    await t.close();
  },
});
export { expect };
