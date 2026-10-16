// Smoke: load the harness in a browser, report console errors, readiness and frame rate. Usage: node scripts/smoke.mjs webkit|shell [scene] [ms]
import { chromium, webkit } from '@playwright/test';
const which = process.argv[2] ?? 'shell';
const scene = process.argv[3] ?? 'lobby';
const ms = parseInt(process.argv[4] ?? '4000', 10);
const browser = which === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:4200/?scene=${scene}&audio=0&perf=1`);
try { await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 }); } catch { logs.push('ready timeout'); }
await page.waitForTimeout(1500);
await page.evaluate(() => window.__moonveil.perfReset());
const t0 = Date.now();
await page.waitForTimeout(ms);
const r = await page.evaluate(() => ({ perf: window.__moonveil.perf(), sim: window.__moonveil.time() }));
const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl'); const d = g?.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : String(g?.getParameter(g.RENDERER)); });
console.log(which, 'renderer:', gl);
console.log('frames in', Date.now() - t0, 'ms:', r.perf?.n, 'frame avg', r.perf?.frame.avg, 'p95', r.perf?.frame.p95, 'sim time', r.sim.toFixed(1));
// tap-to-walk: click empty ground to the right of the local avatar; expect it to move (lobby / ghost only)
const before = await page.evaluate(() => window.__moonveil.localPose());
await page.mouse.click(640, 600);
await page.waitForTimeout(1500);
const after = await page.evaluate(() => window.__moonveil.localPose());
console.log('tap-to-walk moved:', before && after ? Math.hypot(after.x - before.x, after.y - before.y) > 20 : 'n/a');
await page.screenshot({ path: `.cache/smoke-${which}-${scene}.png` });
console.log(logs.join('\n') || 'no console errors');
await browser.close();
