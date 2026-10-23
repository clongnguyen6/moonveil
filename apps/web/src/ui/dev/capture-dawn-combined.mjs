// Dawn UI + scene together (stub, scene ON at `high`, scene debug hooks; needs the lock). A dawn with 2 deaths (wolves'
// victim + Witch poison), survivor and victim views, phone + laptop, Normal + Halloween: the UI announcement over the
// camp at +0.6 s, then the recap with the scene's memorials once both headstones are shown. Also measures, at phone
// sizes (390x844, 375x667), survivor and ghost views, each memorial's stone + name (exact boxes from the scene's debug
// read) against the top bar, chat row, dock and living campers' labels/heads.
//   node scripts/env.mjs node apps/web/src/ui/dev/capture-dawn-combined.mjs      (vite on WEB_PORT, default 4401)
// → docs/ui/screens-dawn/combined/<phone|laptop>-<normal|halloween>-<survivor|victim>-<1-dawn|2-memorials>.jpg
// Limits: browser emulation; boxes are the scene's own layout boxes (debugSeats, needs __MOONVEIL_SCENE_DEBUG), not pixels.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
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

// EXACT memorial layout check from the scene's gated debug read (visual-memorial-fix a98880b): stone + shown name boxes
// (scene-slot CSS px + the slot's page offset) vs the top bar, chat row and dock, and vs every LIVING camper's label and
// head box. Camper-vs-camper overlaps are pre-existing (out of scope): logged as known, never failed.
const exactLayout = async (page, label) => {
  for (let i = 0; i < 6; i++) await page.waitForTimeout(600);   // camera + layout settle (reduced motion = 4 fps)
  const d = await page.evaluate(() => {
    const dbg = globalThis.__moonveilScene?.debugSeats?.(), slot = document.querySelector('[data-testid=scene-slot]');
    if (!dbg || !slot) return null;
    const o = slot.getBoundingClientRect(), page = (b) => (b ? { x0: b.x0 + o.left, y0: b.y0 + o.top, x1: b.x1 + o.left, y1: b.y1 + o.top } : null);
    const ui = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
    const r = globalThis.__stub, g = r.game;
    const alive = new Set(g.match.seats.filter((s) => s.alive).map((s) => g.seatIds[s.seat]));
    const nameOf = (id) => r.players.find((p) => p.id === id)?.name ?? id;
    return {
      ui: { topbar: ui('.topbar'), chat: ui('[data-testid=chat-overlay]'), dock: ui('.dock') },
      memorials: dbg.memorials.filter((m) => m.alpha > 0.9).map((m) => ({ name: m.name, nameShown: m.nameShown, stone: page(m.stoneBox), label: page(m.labelBox) })),
      living: Object.entries(dbg.seats).filter(([id, v]) => alive.has(id) && (v.labelBox || v.headBox)).map(([id, v]) => ({ name: nameOf(id), label: page(v.labelBox), head: page(v.headBox) })),
    };
  });
  if (!d) return ok(`${label}: memorial layout (exact)`, false, 'no debugSeats() (scene debug off or old scene)');
  const hit = (a, b) => !!a && !!b && a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  const vsUi = [], vsLiving = [], known = [];
  for (const m of d.memorials) for (const [part, box] of [['stone', m.stone], ['name', m.label]]) {
    if (!box) continue;
    for (const [k, u] of Object.entries(d.ui)) if (hit(box, u)) vsUi.push(`${m.name} ${part} × ${k}`);
    for (const c of d.living) for (const [cp, cb] of [['label', c.label], ['head', c.head]]) if (hit(box, cb)) vsLiving.push(`${m.name} ${part} × ${c.name} ${cp}`);
  }
  for (let i = 0; i < d.living.length; i++) for (let j = i + 1; j < d.living.length; j++) if (hit(d.living[i].label, d.living[j].label)) known.push(`${d.living[i].name}×${d.living[j].name}`);
  const hidden = d.memorials.filter((m) => !m.nameShown).map((m) => m.name);
  ok(`${label}: ${d.memorials.length} memorials (names shown ${d.memorials.length - hidden.length}${hidden.length ? `, hidden ${hidden.join(',')}` : ''}) clear of the top bar, chat row and dock`, d.memorials.length > 0 && vsUi.length === 0, JSON.stringify(vsUi));
  ok(`${label}: memorial stones + names clear of ${d.living.length} living campers' labels and heads`, d.memorials.length > 0 && vsLiving.length === 0, JSON.stringify(vsLiving));
  if (known.length) console.log(`KNOWN ${label}: pre-existing camper-label overlaps (out of scope): ${known.join(', ')}`);
  await page.screenshot({ path: `${out}/${label.replace(/[^a-z0-9]+/gi, '-')}-layout.jpg`, type: 'jpeg', quality: 76 });
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
      if (dev === 'phone') {
        await exactLayout(page, `${theme} ${who} phone 390x844`);
        await page.setViewportSize({ width: 375, height: 667 });
        await exactLayout(page, `${theme} ${who} phone 375x667`);
        await page.setViewportSize(opts.viewport);
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
