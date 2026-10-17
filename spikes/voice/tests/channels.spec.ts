// Multi-session proof of the approved channel policy (2026-10-16) against a local LiveKit server.
// 10 players + 1 moderator seat in isolated browser contexts; fake mic = continuous 440 Hz tone.
// "Hears X" = received audio energy from X's track grew during a 2 s window.
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { AccessToken } from 'livekit-server-sdk';

const TLS = process.env.VOICE_TLS === '1';
const APP = TLS ? 'https://camp.local:4303' : 'http://127.0.0.1:4302';   // what the browser navigates to
const API = 'http://127.0.0.1:4302';                                         // test driver -> spike server
const LK_WS = TLS ? 'wss://camp.local:4303' : 'ws://127.0.0.1:4300';        // what the browser uses for LiveKit
const PLAYERS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10'];
const MOD = 'mod'; // separate non-player moderator seat: listen everywhere, hidden, no publish
const SEATS = [...PLAYERS, MOD];
const WOLVES = new Set(['p01', 'p02', 'p03']);
const MIC_DENIED = 'p10'; // simulates microphone permission failure
const ENERGY_MIN = 0.004; // totalAudioEnergy growth over 2 s for a -12 dBFS tone is ~0.06

const api = async (p: string, body?: unknown) => {
  const r = await fetch(API + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${await r.text()}`);
  return r.json();
};
const snap = (page: Page) => page.evaluate(() => (window as any).__voice.snapshot()) as Promise<any>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chans = (s: any) => Object.keys(s.channels).sort().join();

const pages = new Map<string, Page>();
const contexts = new Map<string, BrowserContext>();
let browser: Browser;

async function openSeat(id: string) {
  const ctx = await browser.newContext({ permissions: id === MIC_DENIED ? [] : ['microphone'] });
  if (id === MIC_DENIED) {
    await ctx.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${id}] pageerror`, e.message));
  await page.goto(`${APP}/?player=${id}`);
  contexts.set(id, ctx); pages.set(id, page);
  return page;
}

async function settled(epoch: number) {
  // Every page applied the epoch and every entitled channel is connected (or failed with a recorded error).
  for (const [id, page] of pages) {
    await expect.poll(async () => {
      const s = await snap(page);
      if (s.epoch !== epoch) return `epoch ${s.epoch}`;
      for (const [name, c] of Object.entries<any>(s.channels)) if (c.state !== 'connected') return `${name}:${c.state}:${c.connectError ?? ''}`;
      return 'ok';
    }, { message: `${id} settle epoch ${epoch}`, timeout: 40_000 }).toBe('ok');
  }
  await sleep(2500); // let tracks subscribe and audio flow
}

// energy[channel][identity] = growth of totalAudioEnergy over the window (summed over that identity's audio tracks)
async function measure(page: Page, ms = 2000) {
  const a = await snap(page); await sleep(ms); const b = await snap(page);
  const out: Record<string, Record<string, number>> = {};
  for (const [ch, cb] of Object.entries<any>(b.channels)) {
    out[ch] = {};
    for (const [identity, r] of Object.entries<any>(cb.remote)) {
      let e = 0;
      for (const t of r.tracks) {
        const ta = a.channels[ch]?.remote[identity]?.tracks.find((x: any) => x.sid === t.sid);
        if (t.energy != null && ta?.energy != null) e += t.energy - ta.energy;
      }
      out[ch][identity] = e;
    }
  }
  return { before: a, after: b, energy: out };
}
type M = Awaited<ReturnType<typeof measure>>;
const heard = (m: M, ch: string, who: string) => (m.energy[ch]?.[who] ?? 0) > ENERGY_MIN;
const silent = (m: M, ch: string) => Object.values(m.energy[ch] ?? {}).every((e) => e < ENERGY_MIN);
const roomsFromLiveKit = () => api('/api/rooms') as Promise<Record<string, { identity: string; hidden: boolean; canPublish: boolean; tracks: number }[]>>;
const forcePublish = (id: string, ch: string) => pages.get(id)!.evaluate((c) => (window as any).__voice.attack.forcePublish(c), ch);
const connectWith = (id: string, token: string) => pages.get(id)!.evaluate(([u, t]) => (window as any).__voice.attack.connectWith(u, t), [LK_WS, token]);

test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ browser: b }) => { browser = b; });
test.afterAll(async () => { for (const c of contexts.values()) await c.close(); });

test('approved channel policy is enforced server-side across 11 sessions', async () => {
  test.setTimeout(12 * 60 * 1000);
  const results: Record<string, string> = {};
  const check = (name: string, cond: boolean, detail = '') => { results[name] = cond ? 'PASS' : `FAIL ${detail}`; expect(cond, `${name} ${detail}`).toBeTruthy(); };
  const dead = new Set<string>();
  const living = () => PLAYERS.filter((x) => !dead.has(x));

  // ---------- setup + lobby ----------
  const setup = await api('/api/setup', { match: `t${Date.now().toString(36)}`, players: [...PLAYERS.map((id) => ({ id, role: WOLVES.has(id) ? 'wolf' : 'villager' })), { id: MOD, role: 'moderator' }] });
  for (const id of SEATS) await openSeat(id);
  await settled(setup.epoch);
  {
    const [w, v, d, m] = await Promise.all(['p01', 'p05', MIC_DENIED, MOD].map((id) => measure(pages.get(id)!)));
    const others = (me: string) => PLAYERS.filter((x) => x !== me && x !== MIC_DENIED);
    check('lobby: wolf hears everyone', others('p01').every((x) => heard(w, 'public', x)), JSON.stringify(w.energy.public));
    check('lobby: villager hears everyone', others('p05').every((x) => heard(v, 'public', x)), JSON.stringify(v.energy.public));
    check('lobby: mic-denied player still hears everyone', others(MIC_DENIED).every((x) => heard(d, 'public', x)), JSON.stringify(d.energy.public));
    check('lobby: mic-denied player has a recorded mic error and no published track', d.after.micError != null && d.after.channels.public.localPublished === false, JSON.stringify({ micError: d.after.micError }));
    check('lobby: players have only the public channel', chans(w.after) === 'public');
    check('moderator: hears public, is hidden, publishes nothing', others(MOD).every((x) => heard(m, 'public', x)) && m.after.channels.public.perm.hidden === true && m.after.channels.public.localPublished === false, JSON.stringify(m.energy.public));
    check('moderator: players never list the moderator', !(MOD in w.after.channels.public.remote) && !(MOD in v.after.channels.public.remote));
    const r = await forcePublish(MOD, 'public');
    check('moderator: forced publish is rejected by the server', r.ok === false, JSON.stringify(r));
  }

  // ---------- day 1 ----------
  const day1 = await api('/api/phase', { phase: 'day' });
  await settled(day1.epoch);
  {
    const v = await measure(pages.get('p06')!); const w = await snap(pages.get('p02')!);
    check('day: living have exactly the public channel (no wolves room by day)', chans(v.after) === 'public' && chans(w) === 'public', `${chans(v.after)} / ${chans(w)}`);
    check('day: villager hears all living publishers', PLAYERS.filter((x) => x !== 'p06' && x !== MIC_DENIED).every((x) => heard(v, 'public', x)), JSON.stringify(v.energy.public));
  }

  // ---------- night 1 ----------
  const vLogBefore = await pages.get('p06')!.evaluate(() => (window as any).__voice.log.length);
  const night1 = await api('/api/phase', { phase: 'night' });
  await settled(night1.epoch);
  const wolfTokenNight1: string = await pages.get('p01')!.evaluate(() => (window as any).__voice.channels.wolves.token);
  {
    const w1 = await measure(pages.get('p01')!); const w2 = await measure(pages.get('p02')!); const v = await snap(pages.get('p06')!); const m = await measure(pages.get(MOD)!);
    check('night: living villager has no voice channel at all', chans(v) === '', chans(v));
    check('night: wolves have exactly the wolves channel', chans(w1.after) === 'wolves' && chans(w2.after) === 'wolves', chans(w1.after));
    check('night: wolves hear each other', heard(w1, 'wolves', 'p02') && heard(w1, 'wolves', 'p03') && heard(w2, 'wolves', 'p01'), JSON.stringify({ p01: w1.energy.wolves, p02: w2.energy.wolves }));
    check('night: wolves do not see the moderator in their room', !(MOD in w1.after.channels.wolves.remote), Object.keys(w1.after.channels.wolves.remote).join());
    check('night: moderator hears the wolves', heard(m, 'wolves', 'p01') && heard(m, 'wolves', 'p02'), JSON.stringify(m.energy.wolves));
    const lk = await roomsFromLiveKit();
    check('night: LiveKit public room holds nobody but the hidden moderator', lk.public.every((p) => p.identity === MOD && p.hidden), JSON.stringify(lk.public));
    // Uniformity at nightfall: the public room closes for everyone. The villager may see some
    // participants leave before its own disconnect; that order is the SFU's room-close order (Go map
    // iteration), not role-driven. Required: only leave-type events, no publish/speaker events, and
    // one identical leave signature for every participant it did see, wolf or villager.
    const log: any[] = await pages.get('p06')!.evaluate((n) => (window as any).__voice.log.slice(n), vLogBefore);
    const leaveEvs = new Set(['participantDisconnected', 'trackUnpublished', 'trackUnsubscribed', 'disconnected']);
    const perIdentity = new Map<string, string[]>();
    for (const e of log) if (e.identity && e.identity !== 'p06') perIdentity.set(e.identity, [...(perIdentity.get(e.identity) || []), e.ev]);
    const sigs = new Set([...perIdentity.values()].map((v) => v.sort().join('|')));
    const seenWolves = ['p01', 'p02', 'p03'].filter((id) => perIdentity.has(id)).length;
    check('night: villager saw only leave-type events at nightfall, one identical signature for everyone it saw', log.every((e) => leaveEvs.has(e.ev)) && sigs.size <= 1 && log.some((e) => e.ev === 'disconnected'), JSON.stringify({ sigs: [...sigs], evs: [...new Set(log.map((e) => e.ev))], seenWolves, seen: perIdentity.size }));
  }

  // ---------- villager p04 dies at night -> ghost ----------
  const kill1 = await api('/api/kill', { id: 'p04' }); dead.add('p04');
  await settled(kill1.epoch);
  {
    const g = await snap(pages.get('p04')!); const lk = await roomsFromLiveKit(); const m = await snap(pages.get(MOD)!);
    check('ghost: p04 has ghosts + hidden listen-only public, never wolves', chans(g) === 'ghosts,public' && g.channels.public.perm.hidden === true && g.channels.public.localPublished === false, chans(g));
    check('ghost: LiveKit marks p04 hidden in public and visible in ghosts', lk.public.find((p) => p.identity === 'p04')?.hidden === true && lk.ghosts.find((p) => p.identity === 'p04')?.hidden === false, JSON.stringify({ pub: lk.public, gh: lk.ghosts }));
    check('ghost: ghosts do not see the moderator', !(MOD in g.channels.ghosts.remote) && lk.ghosts.find((p) => p.identity === MOD)?.hidden === true);
    check('moderator: listens on all three channels', chans(m) === 'ghosts,public,wolves', chans(m));
    const r = await forcePublish('p04', 'public');
    check('ghost: forced publish into public is rejected', r.ok === false, JSON.stringify(r));
  }

  // ---------- day 2 ----------
  const day2 = await api('/api/phase', { phase: 'day' });
  await settled(day2.epoch);
  {
    const g = await measure(pages.get('p04')!); const v = await measure(pages.get('p06')!); const m = await measure(pages.get(MOD)!);
    const pub = living().filter((x) => x !== MIC_DENIED);
    check('day2: ghost hears all living publishers in public', pub.every((x) => heard(g, 'public', x)), JSON.stringify(g.energy.public));
    check('day2: living never list or hear the ghost', !('p04' in v.after.channels.public.remote) && !v.after.channels.public.activeSpeakers.includes('p04'));
    check('day2: living have no ghosts channel', chans(v.after) === 'public');
    check('day2: moderator hears public', pub.every((x) => heard(m, 'public', x)), JSON.stringify(m.energy.public));
    const lk = await roomsFromLiveKit();
    check('day2: LiveKit wolves room holds nobody but the hidden moderator (wolves not connected by day)', lk.wolves.every((p) => p.identity === MOD), JSON.stringify(lk.wolves));
  }

  // ---------- defense: p06 accused ----------
  const def = await api('/api/phase', { phase: 'defense', accused: 'p06' });
  await settled(def.epoch);
  {
    const v7 = await measure(pages.get('p07')!); const acc = await snap(pages.get('p06')!); const g = await measure(pages.get('p04')!); const m = await measure(pages.get(MOD)!);
    // Approved 2026-10-18: every living player speaks during defense (the accused's focus lives in the step, not in grants).
    const livingNow = PLAYERS.filter((x) => !dead.has(x) && x !== MIC_DENIED);
    check('defense: accused publishes in public', acc.channels.public.localPublished === true && acc.channels.public.perm.canPublish === true);
    check('defense: other living hear every living publisher (incl. the accused)', livingNow.filter((x) => x !== 'p07').every((x) => heard(v7, 'public', x)), JSON.stringify(v7.energy.public));
    const lk = await roomsFromLiveKit();
    check('defense: LiveKit shows one published track per living publisher', lk.public.filter((p) => p.tracks === 1).length === livingNow.length, JSON.stringify(lk.public));
    check('defense: ghost and moderator hear the accused', heard(g, 'public', 'p06') && heard(m, 'public', 'p06'));
  }

  // ---------- wolf p01 voted out -> ghost ----------
  const kill2 = await api('/api/kill', { id: 'p01' }); dead.add('p01');
  await settled(kill2.epoch);
  {
    const g = await snap(pages.get('p01')!);
    check('dead wolf: p01 has ghosts + hidden public, no wolves channel', chans(g) === 'ghosts,public');
    const forged = await new AccessToken('moonveil-dev', 'wrong-secret-wrong-secret-wrong-secret-0000', { identity: 'p01' }).toJwt();
    const f = await connectWith('p01', forged);
    check('forged token (wrong secret) is rejected', f.ok === false, JSON.stringify(f));
    const tok: string = await pages.get('p01')!.evaluate(() => (window as any).__voice.channels.public.token);
    const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
    const roomsNow = (await api('/api/state')).rooms;
    check('token binds room, identity and grants (client cannot choose a room)', payload.video.room === roomsNow.public && payload.sub === 'p01' && payload.video.hidden === true && payload.video.canPublish === false, JSON.stringify(payload.video));
  }

  // ---------- night 2 ----------
  const night2 = await api('/api/phase', { phase: 'night' });
  await settled(night2.epoch);
  {
    const w2 = await measure(pages.get('p02')!); const g1 = await measure(pages.get('p01')!); const g4 = await measure(pages.get('p04')!); const v = await snap(pages.get('p06')!); const m = await measure(pages.get(MOD)!);
    check('night2: remaining wolves hear each other', heard(w2, 'wolves', 'p03'), JSON.stringify(w2.energy.wolves));
    check('night2: dead wolf is gone from the wolves room', !('p01' in w2.after.channels.wolves.remote));
    const stale = await connectWith('p01', wolfTokenNight1);
    check('night2: dead wolf cannot reuse its night-1 wolves token (room rotated, auto_create off)', stale.ok === false, JSON.stringify(stale));
    check('night2: ghosts hear each other on ghosts', heard(g1, 'ghosts', 'p04') && heard(g4, 'ghosts', 'p01'), JSON.stringify({ g1: g1.energy.ghosts, g4: g4.energy.ghosts }));
    check('night2: ghosts have no wolves channel and public is silent for them', !('wolves' in g1.after.channels) && silent(g1, 'public'));
    check('night2: living villager has no channel; living wolf has no ghosts channel', chans(v) === '' && chans(w2.after) === 'wolves');
    check('night2: moderator hears wolves and ghosts', heard(m, 'wolves', 'p02') && heard(m, 'ghosts', 'p04'), JSON.stringify({ w: m.energy.wolves, g: m.energy.ghosts }));
  }

  // ---------- Hunter rule: dead with a pending shot -> no ghost access until resolved ----------
  {
    const kill3 = await api('/api/kill', { id: 'p05', pendingShot: true }); dead.add('p05');
    await settled(kill3.epoch);
    const h = await snap(pages.get('p05')!); const g4 = await snap(pages.get('p04')!); const lk = await roomsFromLiveKit();
    check('hunter pending: only hidden listen-only public, no ghosts channel', chans(h) === 'public' && h.channels.public.perm.hidden === true && h.channels.public.localPublished === false, chans(h));
    check('hunter pending: ghosts do not see the hunter in the ghost room', !('p05' in g4.channels.ghosts.remote) && !lk.ghosts.some((p) => p.identity === 'p05'), JSON.stringify(lk.ghosts));
    check('hunter pending: forced publish into public is rejected', (await forcePublish('p05', 'public')).ok === false);
    const res = await api('/api/resolve', { id: 'p05' });
    await settled(res.epoch);
    const h2 = await measure(pages.get('p05')!); const g4b = await snap(pages.get('p04')!);
    check('hunter resolved: joins ghosts and hears a ghost', 'ghosts' in h2.after.channels && heard(h2, 'ghosts', 'p04'), JSON.stringify(h2.energy.ghosts));
    check('hunter resolved: ghosts now see the hunter', 'p05' in g4b.channels.ghosts.remote);
  }

  // ---------- reconnect preserves identity + entitlements ----------
  {
    await pages.get('p03')!.reload();
    const epochNow = (await api('/api/state')).epoch;
    await expect.poll(async () => { const s = await snap(pages.get('p03')!); return s.epoch === epochNow && chans(s) === 'wolves' && s.channels.wolves.state === 'connected' ? 'ok' : JSON.stringify({ e: s.epoch, c: Object.fromEntries(Object.entries<any>(s.channels).map(([k, c]) => [k, `${c.state} ${c.connectError ?? ''}`])) }); }, { timeout: 40_000 }).toBe('ok');
    await sleep(2500);
    const w3 = await measure(pages.get('p03')!);
    check('reconnect: wolf reloads at night, gets wolves again and hears the other wolf', heard(w3, 'wolves', 'p02'), JSON.stringify(w3.energy.wolves));
    const lk = await roomsFromLiveKit();
    check('reconnect: LiveKit has exactly one p03 in wolves', lk.wolves.filter((p) => p.identity === 'p03').length === 1);
  }

  // ---------- in-person mode ----------
  {
    const inPerson = await api('/api/mode', { mode: 'in-person' });
    await settled(inPerson.epoch);
    const lk = await roomsFromLiveKit();
    const snaps = await Promise.all(SEATS.map((id) => snap(pages.get(id)!)));
    check('in-person: every seat (incl. moderator) has zero voice channels', snaps.every((s) => chans(s) === ''));
    check('in-person: LiveKit rooms are empty', Object.values(lk).every((r) => r.length === 0), JSON.stringify(lk));
    const back = await api('/api/mode', { mode: 'remote' });
    await settled(back.epoch);
    const w2 = await measure(pages.get('p02')!);
    check('in-person -> remote: voice resumes with the same grants', heard(w2, 'wolves', 'p03'), JSON.stringify(w2.energy.wolves));
  }

  console.log('\nRESULTS\n' + Object.entries(results).map(([k, v]) => `${v.padEnd(5)} ${k}`).join('\n'));
  await test.info().attach('results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
