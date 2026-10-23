// Dawn UI + scene together (stub, scene ON at `high`, scene debug hooks; needs the lock). A dawn with 2 deaths (wolves'
// victim + Witch poison), survivor and victim views, phone + laptop, Normal + Halloween: the UI announcement over the
// camp at +0.6 s, then the recap with the scene's memorials once both headstones are shown. Also measures, at phone
// sizes (390x844, 375x667), every campfire seat (memorial stone + name included) against the chat row, top bar and dock.
//   node scripts/env.mjs node apps/web/src/ui/dev/capture-dawn-combined.mjs      (vite on WEB_PORT, default 4401)
// → docs/ui/screens-dawn/combined/<phone|laptop>-<normal|halloween>-<survivor|victim>-<1-dawn|2-memorials>.jpg
// Limits: browser emulation; memorial boxes are seat geometry (createMap seats, the camera from the scene's tap event,
// label allowance as in chat-check), not the sprites' own bounds.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createMap } from '../../../../../packages/scene/src/map.ts';
const base = `http://127.0.0.1:${process.env.WEB_PORT ?? '4401'}/src/ui/dev/index.html`;
const out = 'docs/ui/screens-dawn/combined';
mkdirSync(out, { recursive: true });
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const browser = await chromium.launch();
console.log('[scene] on (high), scene debug on');

const setup = async (page, who) => page.evaluate(([w]) => {
  const r = globalThis.__stub, g = r.game, seats = g.match.seats, idOf = (i) => g.seatIds[i], name = (i) => r.players.find((p) => p.id === idOf(i)).name;
  const witch = seats.find((s) => s.role === 'witch').seat, victim = g.match.nightRec.victim;
  const poisoned = seats.find((s) => s.alive && ![witch, victim].includes(s.seat) && !['wolf', 'hunter'].includes(s.role)).seat;
  const survivor = seats.find((s) => s.alive && ![witch, victim, poisoned].includes(s.seat) && s.role !== 'hunter').seat;
  r.drive({ type: 'witch.heal', seat: witch, use: false });
  r.drive({ type: 'witch.poison', seat: witch, target: poisoned });
  r.setViewer(idOf(w === 'victim' ? poisoned : survivor));
  return { dead: [name(victim), name(poisoned)] };
}, [who]);
const memorials = (page) => page.evaluate(() => globalThis.__moonveilScene?.debugSeats?.()?.memorials ?? null);
const waitMemorials = async (page, n) => { for (let i = 0; i < 40; i++) { const m = await memorials(page); if (m && m.filter((x) => x.alpha > 0.9).length >= n) return m; await page.waitForTimeout(500); } return memorials(page); };

// seats (memorial stone + name included) vs the chat row, top bar and dock, from the scene's camera (tap event) + map
const overlap = async (page, label) => {
  for (let i = 0; i < 6; i++) await page.waitForTimeout(600);   // camera settles after a resize (reduced motion = 4 fps)
  const geo = await page.evaluate(() => {
    const h = globalThis.__moonveilScene, slot = document.querySelector('[data-testid=scene-slot]');
    const r = slot.getBoundingClientRect(), hits = [];
    const off = h.on('tap', (t) => hits.push(t));
    const tap = (x, y) => { const o = { clientX: r.left + x, clientY: r.top + y, pointerId: 91, pointerType: 'mouse', bubbles: true, isPrimary: true }; slot.dispatchEvent(new PointerEvent('pointerdown', o)); window.dispatchEvent(new PointerEvent('pointerup', o)); };
    const pts = [[r.width * 0.2, r.height * 0.3], [r.width * 0.8, r.height * 0.7]];
    for (const [x, y] of pts) tap(x, y); off();
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    return { slot: { x: r.left, y: r.top, w: r.width, h: r.height }, pts, hits, ui: { chat: box('[data-testid=chat-overlay]'), topbar: box('.topbar'), dock: box('.dock') }, n: globalThis.__moonveil?.getState?.().view?.players.length ?? globalThis.__stub.players.length };
  });
  if (geo.hits.length !== 2) return ok(`${label}: memorials clear of UI`, false, 'no scene camera');
  const [[x1, y1], [x2]] = geo.pts, [w1, w2] = geo.hits;
  const sc = (x2 - x1) / (w2.x - w1.x), cx = x1 - w1.x * sc, cy = y1 - w1.y * sc;
  const bad = [];
  for (const s of createMap(geo.n).seats) {
    // stone (raised behind the stump) + its name: up to ~110 world units above the seat, plus one label lift
    const r = { x: geo.slot.x + cx + (s.sit.x - 30) * sc, y: geo.slot.y + cy + (s.sit.y - 110) * sc - 32, w: 60 * sc, h: 135 * sc + 32 };
    for (const [k, b] of Object.entries(geo.ui)) if (b && r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h) bad.push({ seat: [Math.round(s.sit.x), Math.round(s.sit.y)], ui: k });
  }
  // ENVELOPE, not the sprites: up to 110 world units of stone + name above EVERY seat (dead or alive) plus a full label lift;
  // the scene exposes no memorial screen bounds, so a hit here means "inspect the capture", not proven overlap
  ok(`${label}: seat envelope (stone + name allowance, all seats) clear of the chat row, top bar and dock (scale ${sc.toFixed(3)})`, bad.length === 0, JSON.stringify(bad));
  await page.screenshot({ path: `${out}/${label.replace(/[^a-z0-9]+/gi, '-')}-overlap.jpg`, type: 'jpeg', quality: 76 });
};

for (const [dev, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce', locale: 'en-US' });
  await ctx.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'high'; globalThis.__MOONVEIL_SCENE_DEBUG = true; });
  const page = await ctx.newPage();
  for (const theme of ['normal', 'halloween']) {
    for (const who of ['survivor', 'victim']) {
      await page.goto(`${base}?scenario=witch&lang=en&bar=0&sound=0&theme=${theme}`);
      await page.waitForSelector('[data-testid=app]');
      if (theme === 'halloween') await page.waitForFunction(() => document.documentElement.dataset.theme === 'halloween', null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const { dead } = await setup(page, who);
      await page.waitForTimeout(800);
      await page.evaluate(() => globalThis.__stub.closeStep());
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${out}/${dev}-${theme}-${who}-1-dawn.jpg`, type: 'jpeg', quality: 76 });
      const ann = await page.evaluate(() => document.querySelector('[data-testid=announce]')?.innerText.replace(/\n+/g, ' | ') ?? null);
      const m = await waitMemorials(page, 2);
      await page.waitForFunction(() => !document.querySelector('[data-testid=announce]'), null, { timeout: 15000 }).catch(() => {});   // the announcement has ended
      await page.waitForTimeout(1500);   // campers finish the walk back to their seats
      const recap = await page.evaluate(() => document.querySelector('[data-testid=last-night]')?.textContent ?? null);
      await page.screenshot({ path: `${out}/${dev}-${theme}-${who}-2-memorials.jpg`, type: 'jpeg', quality: 76 });
      const shown = (m ?? []).filter((x) => x.alpha > 0.9).map((x) => x.name).sort();
      ok(`${dev} ${theme} ${who}: announcement "${ann}", recap "${recap}", memorials [${shown.join(', ')}]`, !!ann && /Dawn/.test(ann) && recap === `Last night: ${dead.join(', ')} did not wake up.` && JSON.stringify(shown) === JSON.stringify([...dead].sort()), JSON.stringify({ ann, recap, m }));
      if (dev === 'phone' && who === 'survivor') {
        await overlap(page, `${theme} phone 390x844`);
        await page.setViewportSize({ width: 375, height: 667 });
        await overlap(page, `${theme} phone 375x667`);
        await page.setViewportSize(opts.viewport);
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
