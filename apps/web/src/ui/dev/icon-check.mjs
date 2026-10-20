// App icon links against the built server (Chromium headless shell, scene off).
//   node scripts/env.mjs node apps/web/src/ui/dev/icon-check.mjs     (expects apps/web/dist; server on ICON_PORT, default 4466)
// Checks: <head> icon links on "/" and on an SPA route (/r/ABCDEF); every href returns 200 with an image content type,
// bytes identical to apps/web/public; a screenshot sheet renders each linked icon as served (headless Chromium has no
// tab strip, so this is the closest evidence to a tab screenshot) → docs/ui/screens-icon/icons-from-server.png.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const port = Number(process.env.ICON_PORT ?? 4466), base = `http://127.0.0.1:${port}`;
const server = spawn('node', ['apps/server/src/main.ts'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MOONVEIL_ENGINE: 'rules', MOONVEIL_PERSIST: '0' } });
process.on('exit', () => server.kill('SIGTERM'));
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
let fails = 0; const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + extra}`); if (!c) fails++; };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 420 } })).newPage();
await page.addInitScript(() => { globalThis.__MOONVEIL_SCENE = 'off'; });
const linksAt = async (path) => { await page.goto(`${base}${path}`); await page.waitForSelector('[data-testid=app]'); return page.evaluate(() => [...document.querySelectorAll('head link[rel~=icon], head link[rel=apple-touch-icon]')].map((l) => ({ rel: l.rel, sizes: l.getAttribute('sizes'), type: l.getAttribute('type'), href: l.getAttribute('href') }))); };
const want = ['/favicon.ico', '/favicon-16.png', '/favicon-32.png', '/favicon-48.png', '/apple-touch-icon.png'];
const root = await linksAt('/');
ok(`head on "/": ${root.length} icon links (${root.map((l) => l.href).join(', ')})`, JSON.stringify(root.map((l) => l.href)) === JSON.stringify(want) && root.some((l) => l.rel === 'apple-touch-icon' && l.sizes === '180x180'));
const spa = await linksAt('/r/ABCDEF');
ok('head on an SPA route (/r/ABCDEF): same links, root-absolute', JSON.stringify(spa) === JSON.stringify(root));
for (const href of want) {
  const r = await fetch(`${base}${href}`); const buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get('content-type');
  const same = buf.equals(readFileSync(`apps/web/public${href}`));
  console.log(`      ${href}  ${r.status}  ${ct}  ${buf.length} B  identical-to-public=${same}`);
  ok(`${href}: 200, image content type, bytes identical`, r.status === 200 && /^image\//.test(ct ?? '') && same, `status ${r.status}, content-type ${ct}`);
}
// evidence sheet: every linked icon as the built server serves it, native size and 4x (pixelated)
mkdirSync('docs/ui/screens-icon', { recursive: true });
await page.setContent(`<body style="margin:16px;font:14px system-ui;background:#1b2a2f;color:#eee">
  <p>Moonveil icon links as served by ${base} (built dist). Native size, then 4x.</p>
  ${root.map((l) => `<div style="display:flex;align-items:center;gap:16px;margin:8px 0"><code style="width:330px">${l.rel} ${l.sizes ?? ''} ${l.href}</code><img src="${base}${l.href}" style="image-rendering:auto"><img src="${base}${l.href}" style="height:${l.href.includes('apple') ? 90 : 64}px;image-rendering:pixelated"></div>`).join('')}
</body>`);
await page.waitForTimeout(500);
const loaded = await page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
ok('evidence sheet: every linked icon decodes in Chromium', loaded);
await page.screenshot({ path: 'docs/ui/screens-icon/icons-from-server.png', fullPage: true });
console.log('screenshot docs/ui/screens-icon/icons-from-server.png');
await browser.close(); server.kill('SIGTERM');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
