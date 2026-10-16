// Secure-context proof. A phone on the LAN opens http://192.168.x.x: not a secure context, so
// navigator.mediaDevices is undefined and there is no microphone. Here `camp.local` plays the
// LAN address (mapped to 127.0.0.1 by a Chromium flag; localhost/127.0.0.1 would be exempt).
// Then the same origin over https through tls-proxy.mjs, trusted only by SPKI pin for this
// browser process (no trust-store change), yields a secure context and working voice over wss.
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browserHome = path.join(dir, '../.tmp/home');
fs.mkdirSync(browserHome, { recursive: true });
const env = { ...process.env, HOME: browserHome, TMPDIR: path.join(dir, '../.tmp') };
const spki = fs.readFileSync(path.join(dir, '../.certs/leaf.spki'), 'utf8').trim();
const BASE_ARGS = [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${path.join(dir, '../fixtures/tone440.wav')}`,
  '--autoplay-policy=no-user-gesture-required',
  '--host-resolver-rules=MAP camp.local 127.0.0.1',
];
const API = 'http://127.0.0.1:4302';
const api = async (p: string, body?: unknown) => {
  const r = await fetch(API + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
const probe = () => ({
  secure: window.isSecureContext,
  mediaDevices: typeof navigator.mediaDevices,
  getUserMedia: typeof navigator.mediaDevices?.getUserMedia,
});

test('http on a non-localhost host is not a secure context: no microphone API at all', async () => {
  const browser = await chromium.launch({ env, args: BASE_ARGS });
  const page = await (await browser.newContext({ permissions: ['microphone'] })).newPage();
  await page.goto('http://camp.local:4302/?player=probe');
  const r = await page.evaluate(probe);
  await browser.close();
  expect(r).toEqual({ secure: false, mediaDevices: 'undefined', getUserMedia: 'undefined' });
});

test('https with an untrusted certificate is refused by the browser (what a phone without the CA sees)', async () => {
  const browser = await chromium.launch({ env, args: BASE_ARGS });
  const page = await (await browser.newContext()).newPage();
  const err = await page.goto('https://camp.local:4303/?player=probe').then(() => 'loaded', (e) => String(e.message));
  await browser.close();
  expect(err).toMatch(/ERR_CERT_AUTHORITY_INVALID|ERR_CERT_COMMON_NAME_INVALID|net::ERR_CERT/);
});

test('https with a trusted certificate: secure context, microphone, LiveKit over wss, audio flows', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({ env, args: [...BASE_ARGS, `--ignore-certificate-errors-spki-list=${spki}`] });
  const setup = await api('/api/setup', { match: `tls${Date.now().toString(36)}`, players: [{ id: 'a', role: 'villager' }, { id: 'b', role: 'villager' }] });
  const pages = [];
  for (const id of ['a', 'b']) {
    const page = await (await browser.newContext({ permissions: ['microphone'] })).newPage();
    await page.goto(`https://camp.local:4303/?player=${id}`);
    pages.push(page);
  }
  const r = await pages[0].evaluate(probe);
  expect(r).toEqual({ secure: true, mediaDevices: 'object', getUserMedia: 'function' });

  for (const page of pages) {
    await expect.poll(async () => {
      const s = await page.evaluate(() => (window as any).__voice.snapshot());
      return s.epoch === setup.epoch && s.channels.public?.state === 'connected' && s.channels.public.localPublished ? 'ok' : JSON.stringify({ e: s.epoch, c: s.channels.public?.state, p: s.channels.public?.publishError });
    }, { timeout: 30_000 }).toBe('ok');
  }
  const wsUrl: string = await pages[0].evaluate(() => (window as any).__voice.channels.public.perm.url);
  expect(wsUrl).toBe('wss://camp.local:4303');
  await new Promise((r) => setTimeout(r, 2500));
  const a = await pages[0].evaluate(() => (window as any).__voice.snapshot());
  await new Promise((r) => setTimeout(r, 2000));
  const b = await pages[0].evaluate(() => (window as any).__voice.snapshot());
  const energy = (s: any) => s.channels.public.remote.b?.tracks.reduce((acc: number, t: any) => acc + (t.energy ?? 0), 0) ?? 0;
  expect(energy(b) - energy(a)).toBeGreaterThan(0.004);
  await browser.close();
});
