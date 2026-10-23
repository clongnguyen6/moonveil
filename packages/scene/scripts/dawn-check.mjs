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

// name, group, view, url query, steps (scene time after t0) and checks
const S = [];
for (const [dev, vp] of [['laptop', LAPTOP], ['phone', PHONE]]) {
  S.push({ name: `night-death-living-${dev}-high`, group: 'night-death', vp, q: { viewer: 's1', quality: 'high' }, start: 'night', dawn: DEAD_NIGHT, shots: [2.0, 3.35, 9], check: 'night-living' });
  S.push({ name: `day-death-living-${dev}-high`, group: 'day-death', vp, q: { viewer: 's1', quality: 'high' }, start: 'day', die: { at: 0, seats: ['s5'] }, shots: [0.3, 1.5], check: 'day-death' });
}
S.push({ name: 'night-death-victim-laptop-high', group: 'night-death', vp: LAPTOP, q: { viewer: 's3', quality: 'high' }, start: 'night', dawn: DEAD_NIGHT, shots: [2.0, 3.6, 9], check: 'night-victim' });
for (const viewer of ['s1', 's4', 'moderator']) S.push({ name: `race-${viewer}-laptop-high`, group: 'race', vp: LAPTOP, q: { viewer, quality: 'high' }, start: 'night', dawn: [], die: { at: 1.1, seats: RACE }, shots: [5, 9], check: 'race' });
S.push({ name: 'night-death-living-laptop-low', group: 'low', vp: LAPTOP, q: { viewer: 's1', quality: 'low' }, start: 'night', dawn: DEAD_NIGHT, shots: [3.35, 9], check: 'night-living' });
S.push({ name: 'day-death-living-laptop-low', group: 'low', vp: LAPTOP, q: { viewer: 's1', quality: 'low' }, start: 'day', die: { at: 0, seats: ['s5'] }, shots: [0.3, 1.5], check: 'day-death' });
S.push({ name: 'night-death-living-laptop-reduced-motion', group: 'reduced', vp: LAPTOP, reduced: true, q: { viewer: 's1', quality: 'high' }, start: 'night', dawn: DEAD_NIGHT, shots: [3.35, 9], check: 'night-living' });
S.push({ name: 'night-death-living-laptop-high-halloween', group: 'halloween', vp: LAPTOP, q: { viewer: 's1', quality: 'high', theme: 'halloween' }, start: 'night', dawn: DEAD_NIGHT, shots: [3.35, 9], check: 'night-living' });

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
    const T = () => page.evaluate(() => window.__moonveil.time());
    const until = (t) => page.waitForFunction((x) => window.__moonveil.time() >= x, t, { timeout: 180000, polling: 50 });
    await until((await T()) + (sc.start === 'day' ? 4 : 2));   // settled (seated / in tents)
    const t0 = await T(), real0 = Date.now();
    if (sc.start === 'night') await page.evaluate((d) => window.__moonveil.setScene('day', d), sc.dawn);   // dawn
    const samples = []; const shots = [...sc.shots]; const end = Math.max(...sc.shots);
    let died = false;
    for (;;) {
      const t = (await T()) - t0;
      if (sc.die && !died && t >= sc.die.at) { died = true; await page.evaluate((d) => window.__moonveil.setScene('day', d), sc.die.seats); }
      const s = await page.evaluate(() => window.__moonveil.debugSeats?.() ?? null);
      if (s) samples.push({ t: +(s.t - t0).toFixed(2), real: (Date.now() - real0) / 1000, seats: s.seats, lanterns: s.lanterns });
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

function verdict(sc, samples) {
  if (!samples.length) return { ok: null, notes: [] };
  const notes = []; let ok = true;
  const fail = (m) => { ok = false; notes.push(m); };
  const last = samples.at(-1);
  if (sc.check === 'night-living') {
    if (samples.some((s) => s.seats.s3.mode !== 'hidden')) fail('night victim drawn for a living view');
    if (last.lanterns[2] !== 0) fail(`victim lantern ${last.lanterns[2]}`);
    if (!['s1', 's2', 's4', 's5', 's6', 's7', 's8'].every((s) => last.seats[s].mode === 'seated')) fail('not everyone seated');
    const seatedReal = samples.find((s) => ['s1', 's2', 's4', 's5', 's6', 's7', 's8'].every((x) => s.seats[x].mode === 'seated'));
    if (seatedReal) notes.push(`all seated at scene ${seatedReal.t}s / real ${seatedReal.real.toFixed(1)}s`);
  } else if (sc.check === 'night-victim') {
    if (samples.some((s) => s.t < 3.0 && s.seats.s3.mode !== 'hidden')) fail('victim shown before its tent opens');
    if (last.seats.s3.mode !== 'ghost') fail(`victim end ${last.seats.s3.mode}`);
  } else if (sc.check === 'race') {
    const bad = samples.filter((s) => s.t > sc.die.at + 0.15 && RACE.some((x) => LIVING.includes(s.seats[x].mode)));
    if (bad.length) fail(`dead seat drawn alive at ${bad[0].t}s: ${RACE.map((x) => `${x}=${bad[0].seats[x].mode}`).join(' ')}`);
    notes.push(`end ${RACE.map((x) => `${x}=${last.seats[x].mode}`).join(' ')}`);
  } else if (sc.check === 'day-death') {
    const mid = samples.find((s) => s.t > 0.1 && s.t < 0.5);
    if (mid && !(mid.seats.s5.dying && mid.seats.s5.alpha < 1)) fail('no fade at the seat');
    if (last.seats.s5.mode !== 'hidden') fail(`after the fade ${last.seats.s5.mode}`);
    if (samples.some((s) => s.seats.s5.mode === 'ghost')) fail('living view drew a ghost');
  }
  return { ok, notes };
}
