// Dawn and death presentation check on the scene dev page (fixtures only: no server, no voice). Browser EMULATION.
// Needs the browser lock. Times are on the SCENE clock (__moonveil.time()), so load / frame rate cannot change the outcome.
// Asserts with debugSeats() when the build has it (old builds: captures only, assertions "n/a").
//   node scripts/env.mjs node packages/scene/scripts/dawn-check.mjs --out .cache/dawn/after [--only race,day-death]
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const pkg = resolve(arg('--pkg', resolve(import.meta.dirname, '..')));
const out = resolve(arg('--out', '.cache/dawn/after'));
const only = arg('--only', '')?.split(',').filter(Boolean);
const port = Number(process.env.DAWN_PORT ?? 4240);
mkdirSync(out, { recursive: true });
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LAPTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const LIVING = ['idle', 'walk', 'seated'];
const DEAD_NIGHT = ['s3'], RACE = ['s4', 's8'];

// name, group, view, url query, steps (scene time after t0: switch to scene with these dead seats), shots, checks
const S = [];
const dawn = (dead) => [{ at: 0, scene: 'day', dead }];
const MULTI = ['s2', 's5', 's7'];
for (const [dev, vp] of [['laptop', LAPTOP], ['phone', PHONE]]) {
  S.push({ name: `night-death-living-${dev}-high`, group: 'night-death', vp, q: { viewer: 's1', quality: 'high' }, start: 'night', steps: dawn(DEAD_NIGHT), shots: [2.0, 3.35, 9], check: 'night-living' });
  S.push({ name: `day-death-living-${dev}-high`, group: 'day-death', vp, q: { viewer: 's1', quality: 'high' }, start: 'day', steps: [{ at: 0, scene: 'day', dead: ['s5'] }], shots: [0.3, 1.5], check: 'day-death' });
  for (const theme of ['', 'halloween']) S.push({ name: `memorials-${dev}${theme ? '-halloween' : ''}`, group: 'memorials', vp, q: { viewer: 's1', quality: 'high', ...(theme ? { theme } : {}) },
    start: 'night', steps: [{ at: 0, scene: 'day', dead: MULTI }, { at: 10, scene: 'night', dead: MULTI }], shots: [10, 19], check: 'memorials' });
}
// memorial layout at the UI's scene-slot sizes (top bar 56 px; 375x667 also the chat row 64 px), survivor and ghost view
const SLOT375 = { viewport: { width: 375, height: 253 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, SLOT390 = { viewport: { width: 390, height: 428 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
for (const [dev, vp, safe] of [['slot375x253', SLOT375, { top: 56, bottom: 64 }], ['slot390x428', SLOT390, { top: 56 }], ['laptop', LAPTOP, { top: 56 }]])
  for (const theme of ['', 'halloween']) for (const viewer of ['s1', 's2'])
    S.push({ name: `layout-${dev}${theme ? '-halloween' : ''}-${viewer === 's1' ? 'survivor' : 'ghost'}`, group: 'layout', vp, safe, q: { viewer, quality: 'high', ...(theme ? { theme } : {}) },
      start: 'night', steps: [{ at: 0, scene: 'day', dead: MULTI }], shots: [10], check: 'layout' });
S.push({ name: 'night-death-victim-laptop-high', group: 'night-death', vp: LAPTOP, q: { viewer: 's3', quality: 'high' }, start: 'night', steps: dawn(DEAD_NIGHT), shots: [2.0, 3.6, 9], check: 'night-victim' });
for (const viewer of ['s1', 's4', 'moderator']) S.push({ name: `race-${viewer}-laptop-high`, group: 'race', vp: LAPTOP, q: { viewer, quality: 'high' }, start: 'night', steps: [{ at: 0, scene: 'day', dead: [] }, { at: 1.1, scene: 'day', dead: RACE }], shots: [5, 9], check: 'race' });
S.push({ name: 'night-death-living-laptop-low', group: 'low', vp: LAPTOP, q: { viewer: 's1', quality: 'low' }, start: 'night', steps: dawn(DEAD_NIGHT), shots: [3.35, 9], check: 'night-living' });
S.push({ name: 'day-death-living-laptop-low', group: 'low', vp: LAPTOP, q: { viewer: 's1', quality: 'low' }, start: 'day', steps: [{ at: 0, scene: 'day', dead: ['s5'] }], shots: [0.3, 1.5], check: 'day-death' });
S.push({ name: 'night-death-living-laptop-reduced-motion', group: 'reduced', vp: LAPTOP, reduced: true, q: { viewer: 's1', quality: 'high' }, start: 'night', steps: dawn(DEAD_NIGHT), shots: [3.35, 9], check: 'night-living' });
S.push({ name: 'night-death-living-laptop-high-halloween', group: 'halloween', vp: LAPTOP, q: { viewer: 's1', quality: 'high', theme: 'halloween' }, start: 'night', steps: dawn(DEAD_NIGHT), shots: [3.35, 9], check: 'night-living' });

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: pkg, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, no) => { vite.stdout.on('data', (d) => { if (String(d).includes('Local')) ok(); }); vite.on('exit', (c) => no(new Error(`vite exited ${c}`))); });
const report = { load: [execSync('uptime').toString().trim()], runs: [] }; let failed = false;
try {
  const browser = await chromium.launch();
  for (const sc of S) {
    if (only?.length && !only.includes(sc.group)) continue;
    const ctx = await browser.newContext({ ...sc.vp, ...(sc.reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { failed = true; console.error('pageerror', sc.name, e.message); });
    await page.goto(`http://127.0.0.1:${port}/?${new URLSearchParams({ scene: sc.start, n: '8', audio: '0', panel: '0', speak: '0', ...sc.q })}`);
    await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 60000 });
    if (sc.safe) await page.evaluate((s) => window.__moonveil.setSafeArea?.(s), sc.safe);
    const T = () => page.evaluate(() => window.__moonveil.time());
    const until = (t) => page.waitForFunction((x) => window.__moonveil.time() >= x, t, { timeout: 180000, polling: 50 });
    await until((await T()) + (sc.start === 'day' ? 4 : 2));   // settled (seated / in tents)
    const t0 = await T(), real0 = Date.now();
    const samples = []; const shots = [...sc.shots]; const end = Math.max(...sc.shots); const steps = [...sc.steps];
    for (;;) {
      const t = (await T()) - t0;
      while (steps.length && t >= steps[0].at) { const st = steps.shift(); await page.evaluate(([sn, d]) => window.__moonveil.setScene(sn, d), [st.scene, st.dead]); }
      const s = await page.evaluate(() => window.__moonveil.debugSeats?.() ?? null);
      if (s) samples.push({ t: +(s.t - t0).toFixed(2), real: (Date.now() - real0) / 1000, seats: s.seats, lanterns: s.lanterns, memorials: s.memorials ?? [] });
      if (shots.length && t >= shots[0]) { const at = shots.shift(); await page.screenshot({ path: join(out, `${sc.name}-t${at}.png`) }); }
      if (t >= end && !shots.length) break;
      await page.waitForTimeout(100);
    }
    const r = verdict(sc, samples);
    if (r.ok === false) failed = true;
    report.runs.push({ name: sc.name, group: sc.group, ...r, samples: samples.length });
    console.log(`${sc.name}: ${r.ok === null ? 'n/a (no debugSeats)' : r.ok ? 'OK' : 'FAIL'} ${r.notes.join('; ')}`);
    await ctx.close();
  }
  await browser.close();
} finally { vite.kill('SIGTERM'); report.load.push(execSync('uptime').toString().trim()); writeFileSync(join(out, 'dawn-check.json'), JSON.stringify(report, null, 1) + '\n'); }
process.exit(failed ? 1 : 0);

const hit = (a, b) => !!a && !!b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// memorial names / stones vs camper labels, camper head boxes, stones and each other (screen boxes from debugSeats)
function layoutOverlaps(smp) {
  const bad = [], mem = smp.memorials ?? [], seats = Object.entries(smp.seats).filter(([, v]) => v.headBox);
  for (const m of mem) {
    for (const [s, v] of seats) {
      if (hit(m.labelBox, v.labelBox)) bad.push(`${m.seat} name on ${s} label`);
      if (hit(m.labelBox, v.headBox)) bad.push(`${m.seat} name on ${s} camper`);
      if (hit(m.stoneBox, v.labelBox)) bad.push(`${s} label on ${m.seat} stone`);
      if (hit(m.stoneBox, v.headBox)) bad.push(`${m.seat} stone on ${s} camper`);
    }
    for (const o of mem) if (o !== m) { if (hit(m.labelBox, o.labelBox) && m.seat < o.seat) bad.push(`${m.seat}/${o.seat} names`); if (hit(m.labelBox, o.stoneBox)) bad.push(`${m.seat} name on ${o.seat} stone`); }
    if (hit(m.labelBox, m.stoneBox)) bad.push(`${m.seat} name on its stone`);
  }
  return bad;
}
function verdict(sc, samples) {
  if (!samples.length) return { ok: null, notes: [] };
  const notes = []; let ok = true;
  const fail = (m) => { ok = false; notes.push(m); };
  if (samples.at(-1).memorials?.[0] && 'stoneBox' in samples.at(-1).memorials[0]) {   // builds with layout boxes
    const bad = layoutOverlaps(samples.at(-1)); if (bad.length) fail(`overlaps: ${bad.slice(0, 4).join('; ')}`);
  }
  const last = samples.at(-1);
  const memo = (smp) => (smp.memorials ?? []).map((m) => m.seat).sort().join(',');
  const named = (smp, seat) => (smp.memorials ?? []).find((m) => m.seat === seat)?.nameShown === true;
  if (sc.check === 'night-living') {
    if (samples.some((s) => s.seats.s3.mode !== 'hidden')) fail('night victim drawn for a living view');
    if (last.lanterns[2] !== 0) fail(`victim lantern ${last.lanterns[2]}`);
    if (!['s1', 's2', 's4', 's5', 's6', 's7', 's8'].every((s) => last.seats[s].mode === 'seated')) fail('not everyone seated');
    const seatedReal = samples.find((s) => ['s1', 's2', 's4', 's5', 's6', 's7', 's8'].every((x) => s.seats[x].mode === 'seated'));
    if (seatedReal) notes.push(`all seated at scene ${seatedReal.t}s / real ${seatedReal.real.toFixed(1)}s`);
    if (samples.some((s) => s.t < 3.0 && memo(s))) fail('memorial before the victim\u2019s tent beat');
    if (memo(last) !== 's3' || !named(last, 's3')) fail(`memorials at end: ${memo(last)}`);
  } else if (sc.check === 'night-victim') {
    if (samples.some((s) => s.t < 3.0 && s.seats.s3.mode !== 'hidden')) fail('victim shown before its tent opens');
    if (last.seats.s3.mode !== 'ghost') fail(`victim end ${last.seats.s3.mode}`);
    if (memo(last) !== 's3') fail(`memorials at end: ${memo(last)}`);
  } else if (sc.check === 'race') {
    const dieAt = sc.steps.at(-1).at;
    const bad = samples.filter((s) => s.t > dieAt + 0.15 && RACE.some((x) => LIVING.includes(s.seats[x].mode)));
    if (bad.length) fail(`dead seat drawn alive at ${bad[0].t}s: ${RACE.map((x) => `${x}=${bad[0].seats[x].mode}`).join(' ')}`);
    notes.push(`end ${RACE.map((x) => `${x}=${last.seats[x].mode}`).join(' ')}; memorials ${memo(last)}; names ${RACE.map((x) => `${x}:${named(last, x) ? 'stone' : 'ghost'}`).join(' ')}`);
    if (memo(last) !== RACE.join(',')) fail(`memorials at end: ${memo(last)}`);
    if (sc.q.viewer === 's1' && !RACE.every((x) => named(last, x))) fail('living view: memorial names missing');
  } else if (sc.check === 'day-death') {
    const mid = samples.find((s) => s.t > 0.1 && s.t < 0.5);
    if (mid && !(mid.seats.s5.dying && mid.seats.s5.alpha < 1)) fail('no fade at the seat');
    if (last.seats.s5.mode !== 'hidden') fail(`after the fade ${last.seats.s5.mode}`);
    if (samples.some((s) => s.seats.s5.mode === 'ghost')) fail('living view drew a ghost');
    if (samples.some((s) => s.t < 0.55 && memo(s))) fail('memorial before the death fade ended');
    if (memo(last) !== 's5' || !named(last, 's5')) fail(`memorials at end: ${memo(last)}`);
  } else if (sc.check === 'layout') {
    const m = last.memorials ?? [];
    if (m.map((x) => x.seat).sort().join(',') !== MULTI.join(',')) fail(`memorials ${memo(last)}`);
    const hidden = m.filter((x) => !x.labelBox).map((x) => x.seat);
    notes.push(`names placed ${m.length - hidden.length}/${m.length}${hidden.length ? ` (hidden: ${hidden.join(',')})` : ''}`);
  } else if (sc.check === 'memorials') {
    const day = samples.find((s) => s.t >= 9.5 && s.t < 10), night = last;
    for (const [when, smp] of [['day', day], ['night', night]]) {
      if (!smp) { fail(`no ${when} sample`); continue; }
      if (memo(smp) !== MULTI.join(',')) fail(`${when}: memorials ${memo(smp)}`);
      if (!MULTI.every((x) => named(smp, x))) fail(`${when}: a memorial name hidden in a living view`);
      if (MULTI.some((x) => smp.seats[x].mode !== 'hidden')) fail(`${when}: a dead seat drawn for a living view`);
    }
    notes.push(`day ${day ? memo(day) : '-'} / night ${memo(night)}`);
  }
  return { ok, notes };
}
