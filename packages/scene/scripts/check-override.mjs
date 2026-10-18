// Rendered-state check of the local appearance override (WebKit, harness on :4200 with debug hooks).
// Asserts via debugAppearance/localPose what is actually rendered; writes a screenshot pair.
import { webkit } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const outDir = resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '../../docs/visual/look');
mkdirSync(outDir, { recursive: true });
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:4200/?scene=lobby&n=6&audio=0&panel=0&speak=0');
await page.waitForFunction(() => window.__moonveil?.ready, null, { timeout: 30000 });
const waitSim = async (sec) => { const t0 = await page.evaluate(() => window.__moonveil.time()); await page.waitForFunction((t) => window.__moonveil.time() >= t, t0 + sec, { timeout: 60000, polling: 100 }); };
await waitSim(2);
const read = () => page.evaluate(() => ({ me: window.__moonveil.debugAppearance('s1'), other: window.__moonveil.debugAppearance('s2'), pose: window.__moonveil.localPose() }));
const before = await read();
await page.screenshot({ path: join(outDir, 'override-1-saved-look.jpg'), type: 'jpeg', quality: 86 });
await page.evaluate(() => window.__moonveil.setLocalLook({ hat: 'bucket', top: 'sand', hair: 'curly' }));
await waitSim(1);
const during = await read();
await page.screenshot({ path: join(outDir, 'override-2-draft-preview.jpg'), type: 'jpeg', quality: 86 });
// a snapshot update during the draft (another seat changes look) must not clear it
await page.evaluate(() => window.__moonveil.setLook('s3', { hat: 'cap' }));
await waitSim(1);
const afterSnapshot = await read();
await page.evaluate(() => window.__moonveil.setLocalLook(null));
await waitSim(1);
const cleared = await read();
const ok = (c, m) => console.log(c ? 'ok  ' : 'FAIL', m);
ok(during.me.hat === 'bucket' && during.me.top === 'sand' && during.me.hair === 'curly', 'local avatar renders the draft');
ok(JSON.stringify(during.other) === JSON.stringify(before.other), 'remote avatar unchanged by the draft');
ok(Math.abs(during.pose.x - before.pose.x) < 1 && Math.abs(during.pose.y - before.pose.y) < 1 && during.pose.facing === before.pose.facing, 'local position and facing preserved');
ok(afterSnapshot.me.hat === 'bucket', 'draft survives a snapshot update');
ok(JSON.stringify(cleared.me) === JSON.stringify(before.me), 'clearing restores the saved look');
await browser.close();
