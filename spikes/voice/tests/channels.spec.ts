// Multi-session proof of the Moonveil channel rules against a local LiveKit server.
// 10 players in 10 isolated browser contexts; fake mic = continuous 440 Hz tone.
// "Hears X" = received audio energy from X's track grew during a 2 s window.
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { AccessToken } from 'livekit-server-sdk';

const APP = 'http://127.0.0.1:4302';
const LK_WS = 'ws://127.0.0.1:4300';
const PLAYERS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10'];
const WOLVES = new Set(['p01', 'p02', 'p03']);
const MIC_DENIED = 'p10'; // simulates microphone permission failure
const ENERGY_MIN = 0.004; // totalAudioEnergy growth over 2 s for a -12 dBFS tone is ~0.06

type Snapshot = Awaited<ReturnType<typeof snap>>;
const api = async (p: string, body?: unknown) => {
  const r = await fetch(APP + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${await r.text()}`);
  return r.json();
};
const snap = (page: Page) => page.evaluate(() => (window as any).__voice.snapshot()) as Promise<any>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pages = new Map<string, Page>();
const contexts = new Map<string, BrowserContext>();
let browser: Browser;

async function openPlayer(id: string) {
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
  // Every page has applied the epoch and every entitled channel is connected (or has failed with a recorded error).
  for (const [id, page] of pages) {
    await expect.poll(async () => {
      const s = await snap(page);
      if (s.epoch !== epoch) return `epoch ${s.epoch}`;
      for (const [name, c] of Object.entries<any>(s.channels)) if (c.state !== 'connected') return `${name}:${c.state}`;
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
const heard = (m: Awaited<ReturnType<typeof measure>>, ch: string, who: string) => (m.energy[ch]?.[who] ?? 0) > ENERGY_MIN;
const roomsFromLiveKit = () => api('/api/rooms') as Promise<Record<string, { identity: string; hidden: boolean; canPublish: boolean; tracks: number }[]>>;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser: b }) => { browser = b; });
test.afterAll(async () => { for (const c of contexts.values()) await c.close(); });

test('voice channel rules are enforced server-side across 10 sessions', async () => {
  test.setTimeout(10 * 60 * 1000);
  const results: Record<string, string> = {};
  const check = (name: string, cond: boolean, detail = '') => { results[name] = cond ? 'PASS' : `FAIL ${detail}`; expect(cond, `${name} ${detail}`).toBeTruthy(); };

  // ---------- setup + lobby ----------
  const setup = await api('/api/setup', { match: `t${Date.now().toString(36)}`, players: PLAYERS.map((id) => ({ id, role: WOLVES.has(id) ? 'wolf' : 'villager' })) });
  for (const id of PLAYERS) await openPlayer(id);
  await settled(setup.epoch);

  {
    const m = await Promise.all(['p01', 'p05', MIC_DENIED].map((id) => measure(pages.get(id)!)));
    const [w, v, d] = m;
    const others = (me: string) => PLAYERS.filter((x) => x !== me && x !== MIC_DENIED);
    check('lobby: wolf hears everyone', others('p01').every((x) => heard(w, 'public', x)), JSON.stringify(w.energy.public));
    check('lobby: villager hears everyone', others('p05').every((x) => heard(v, 'public', x)), JSON.stringify(v.energy.public));
    check('lobby: mic-denied player still hears everyone', others(MIC_DENIED).every((x) => heard(d, 'public', x)), JSON.stringify(d.energy.public));
    check('lobby: mic-denied player connected with a recorded mic error and no published track', d.after.micError != null && d.after.channels.public.localPublished === false, JSON.stringify({ micError: d.after.micError }));
    check('lobby: only the public channel exists', Object.keys(w.after.channels).join() === 'public');
  }

  // ---------- day (match start) ----------
  const day1 = await api('/api/phase', { phase: 'day' });
  await settled(day1.epoch);
  {
    const w = await measure(pages.get('p02')!); const v = await measure(pages.get('p06')!);
    check('day: living villager has only the public channel', Object.keys(v.after.channels).join() === 'public', Object.keys(v.after.channels).join());
    check('day: wolf is connected to wolves channel but it carries no audio', 'wolves' in w.after.channels && w.after.channels.wolves.localPublished === false && Object.values(w.energy.wolves).every((e) => e < ENERGY_MIN), JSON.stringify(w.energy.wolves));
    check('day: villager hears all living publishers publicly', PLAYERS.filter((x) => x !== 'p06' && x !== MIC_DENIED).every((x) => heard(v, 'public', x)), JSON.stringify(v.energy.public));
  }

  // ---------- night 1 ----------
  const vLogBefore = await pages.get('p06')!.evaluate(() => (window as any).__voice.log.length);
  const night1 = await api('/api/phase', { phase: 'night' });
  await settled(night1.epoch);
  {
    const w1 = await measure(pages.get('p01')!); const w2 = await measure(pages.get('p02')!); const v = await measure(pages.get('p06')!);
    check('night: wolves hear each other on the wolves channel', heard(w1, 'wolves', 'p02') && heard(w1, 'wolves', 'p03') && heard(w2, 'wolves', 'p01'), JSON.stringify({ p01: w1.energy.wolves, p02: w2.energy.wolves }));
    check('night: villager has only the public channel', Object.keys(v.after.channels).join() === 'public');
    check('night: public channel is silent for everyone', Object.values(v.energy.public).every((e) => e < ENERGY_MIN) && Object.values(w1.energy.public).every((e) => e < ENERGY_MIN), JSON.stringify(v.energy.public));
    check('night: villager sees no speaking indicator anywhere', v.after.channels.public.activeSpeakers.length === 0 && Object.values<any>(v.after.channels.public.remote).every((r) => !r.isSpeaking));
    check('night: villager still sees all 9 others in public (no participant-list change)', Object.keys(v.after.channels.public.remote).length === 9, Object.keys(v.after.channels.public.remote).join());
    check('night: no public participant exposes an audio track', Object.values<any>(v.after.channels.public.remote).every((r) => r.tracks.filter((t: any) => t.kind === 'audio').length === 0));

    // Uniformity: the villager observed the same event types, in one burst, for wolves and for villagers.
    const log: any[] = await pages.get('p06')!.evaluate((n) => (window as any).__voice.log.slice(n), vLogBefore);
    const perIdentity = new Map<string, string[]>();
    for (const e of log) if (e.identity && e.identity !== 'p06' && e.ch === 'public') perIdentity.set(e.identity, [...(perIdentity.get(e.identity) || []), e.ev]);
    const sig = (ids: string[]) => ids.map((id) => (perIdentity.get(id) || []).sort().join('|'));
    const wolfSigs = sig(['p01', 'p02', 'p03']); const villSigs = sig(['p05', 'p07', 'p08', 'p09']);
    check('night: villager saw identical event signatures for wolves and villagers', new Set([...wolfSigs, ...villSigs]).size === 1, JSON.stringify({ wolfSigs, villSigs }));
    const unpubTimes = log.filter((e) => e.ev === 'trackUnpublished').map((e) => e.t);
    const spread = unpubTimes.length ? Math.max(...unpubTimes) - Math.min(...unpubTimes) : 0;
    check('night: all unpublish events arrived within one 1 s burst', unpubTimes.length >= 8 && spread < 1000, `n=${unpubTimes.length} spread=${spread.toFixed(0)}ms`);

    // Attack: a villager forces a publish at night. Server must reject; wolves must not see a track.
    const r = await pages.get('p06')!.evaluate(() => (window as any).__voice.attack.forcePublish('public'));
    await sleep(1500);
    const lk = await roomsFromLiveKit();
    const wView = await snap(pages.get('p01')!);
    check('night: forced publish by a villager is rejected by the server', r.ok === false, JSON.stringify(r));
    check('night: LiveKit shows zero tracks in public after the attack', lk.public.every((p) => p.tracks === 0), JSON.stringify(lk.public));
    check('night: wolf observes no track from the attacking villager', (wView.channels.public.remote.p06?.tracks.length ?? 0) === 0);
  }

  // ---------- villager p04 dies at night -> ghost ----------
  const alivePublicTokenP04: string = await pages.get('p04')!.evaluate(() => (window as any).__voice.channels.public.token);
  const roomsBeforeKill = (await api('/api/state')).rooms;
  const kill1 = await api('/api/kill', { id: 'p04' });
  await settled(kill1.epoch);
  {
    const roomsAfterKill = (await api('/api/state')).rooms;
    check('death: public channel rotated to a new room (stale tokens die with the old room)', roomsAfterKill.public !== roomsBeforeKill.public, JSON.stringify({ roomsBeforeKill, roomsAfterKill }));
    const stalePublic = await pages.get('p04')!.evaluate(([u, t]) => (window as any).__voice.attack.connectWith(u, t), [LK_WS, alivePublicTokenP04]);
    check('death: ghost cannot rejoin public with its old living token', stalePublic.ok === false, JSON.stringify(stalePublic));
    const g = await snap(pages.get('p04')!); const v = await snap(pages.get('p06')!); const w = await snap(pages.get('p01')!);
    check('ghost: p04 has public(hidden, listen) + ghosts, never wolves', Object.keys(g.channels).sort().join() === 'ghosts,public' && g.channels.public.perm.hidden === true && g.channels.public.localPublished === false, Object.keys(g.channels).join());
    check('ghost: living players do not list p04 in public', !('p04' in v.channels.public.remote) && !('p04' in w.channels.public.remote));
    const lk = await roomsFromLiveKit();
    check('ghost: LiveKit marks p04 hidden in public', lk.public.find((p) => p.identity === 'p04')?.hidden === true, JSON.stringify(lk.public));
    const r = await pages.get('p04')!.evaluate(() => (window as any).__voice.attack.forcePublish('public'));
    check('ghost: forced publish into public is rejected', r.ok === false, JSON.stringify(r));
  }

  // ---------- day 2 ----------
  const day2 = await api('/api/phase', { phase: 'day' });
  await settled(day2.epoch);
  const staleWolfToken: string = await pages.get('p01')!.evaluate(() => (window as any).__voice.channels.wolves.token);
  {
    const g = await measure(pages.get('p04')!); const v = await measure(pages.get('p06')!);
    const living = PLAYERS.filter((x) => x !== 'p04' && x !== MIC_DENIED);
    check('day2: ghost hears all living publishers in public', living.every((x) => heard(g, 'public', x)), JSON.stringify(g.energy.public));
    check('day2: living never hears or lists the ghost', !('p04' in v.after.channels.public.remote) && !v.after.channels.public.activeSpeakers.includes('p04'));
    check('day2: ghost sees living speaking indicators', v.after.channels.public.activeSpeakers.length > 0 || g.after.channels.public.activeSpeakers.length > 0, JSON.stringify(g.after.channels.public.activeSpeakers));
  }

  // ---------- wolf p01 voted out -> ghost ----------
  const kill2 = await api('/api/kill', { id: 'p01' });
  await settled(kill2.epoch);
  {
    const g = await snap(pages.get('p01')!); const w = await snap(pages.get('p02')!);
    check('dead wolf: p01 now has ghosts + hidden public, no wolves channel', Object.keys(g.channels).sort().join() === 'ghosts,public');
    check('dead wolf: remaining wolves no longer see p01 in wolves', !('p01' in w.channels.wolves.remote), Object.keys(w.channels.wolves.remote).join());
    const stale = await pages.get('p01')!.evaluate(([u, t]) => (window as any).__voice.attack.connectWith(u, t), [LK_WS, staleWolfToken]);
    check('dead wolf: stale wolves token is rejected after removal', stale.ok === false, JSON.stringify(stale));
    const forged = await new AccessToken('moonveil-dev', 'wrong-secret-wrong-secret-wrong-secret-0000', { identity: 'p01' }).addGrant({ room: `${setup.match}-wolves`, roomJoin: true }) && await new AccessToken('moonveil-dev', 'wrong-secret-wrong-secret-wrong-secret-0000', { identity: 'p01' }).toJwt();
    const f = await pages.get('p01')!.evaluate(([u, t]) => (window as any).__voice.attack.connectWith(u, t), [LK_WS, forged as string]);
    check('forged token (wrong secret) is rejected', f.ok === false, JSON.stringify(f));
    // Ghost token for public has canSubscribe but the room has nothing hidden to find; and ghosts' public token cannot be used to reach wolves (room is bound in the token).
    const ghostPublicToken: string = await pages.get('p01')!.evaluate(() => (window as any).__voice.channels.public.token);
    const payload = JSON.parse(Buffer.from(ghostPublicToken.split('.')[1], 'base64url').toString());
    const roomsNow = (await api('/api/state')).rooms;
    check('token binds the room name; client cannot pick another room', payload.video.room === roomsNow.public && payload.video.hidden === true && payload.video.canPublish === false, JSON.stringify({ video: payload.video, roomsNow }));
  }

  // ---------- night 2 ----------
  const night2 = await api('/api/phase', { phase: 'night' });
  await settled(night2.epoch);
  {
    const w2 = await measure(pages.get('p02')!); const g1 = await measure(pages.get('p01')!); const g4 = await measure(pages.get('p04')!); const v = await measure(pages.get('p06')!);
    check('night2: remaining wolves hear each other', heard(w2, 'wolves', 'p03'), JSON.stringify(w2.energy.wolves));
    check('night2: ghosts hear each other on ghosts', heard(g1, 'ghosts', 'p04') && heard(g4, 'ghosts', 'p01'), JSON.stringify({ g1: g1.energy.ghosts, g4: g4.energy.ghosts }));
    check('night2: ghosts have no wolves channel and hear nothing public', !('wolves' in g1.after.channels) && Object.values(g1.energy.public).every((e) => e < ENERGY_MIN));
    check('night2: living hear nothing from ghosts or wolves', Object.values(v.energy.public).every((e) => e < ENERGY_MIN) && Object.keys(v.after.channels).join() === 'public');
    check('night2: living wolf hears nothing from ghosts', !('ghosts' in w2.after.channels) && !('p01' in w2.after.channels.public.remote) && !('p04' in w2.after.channels.public.remote));
  }

  // ---------- reconnect preserves identity + entitlements ----------
  {
    await pages.get('p03')!.reload();
    await expect.poll(async () => { const s = await snap(pages.get('p03')!); return s.epoch === night2.epoch && Object.values<any>(s.channels).every((c) => c.state === 'connected') ? 'ok' : 'wait'; }, { timeout: 40_000 }).toBe('ok');
    await sleep(2500);
    const w3 = await measure(pages.get('p03')!);
    check('reconnect: wolf reloads, gets wolves again and hears the other wolf', heard(w3, 'wolves', 'p02'), JSON.stringify(w3.energy.wolves));
    const lk = await roomsFromLiveKit();
    check('reconnect: LiveKit has exactly one p03 in wolves', lk.wolves.filter((p) => p.identity === 'p03').length === 1);
  }

  // ---------- in-person mode ----------
  const inPerson = await api('/api/mode', { mode: 'in-person' });
  await settled(inPerson.epoch);
  {
    const lk = await roomsFromLiveKit();
    const snaps = await Promise.all(PLAYERS.map((id) => snap(pages.get(id)!)));
    check('in-person: every client has zero voice channels', snaps.every((s) => Object.keys(s.channels).length === 0));
    check('in-person: LiveKit rooms are empty', Object.values(lk).every((r) => r.length === 0), JSON.stringify(lk));
    const back = await api('/api/mode', { mode: 'remote' });
    await settled(back.epoch);
    const w2 = await measure(pages.get('p02')!);
    check('in-person -> remote: voice resumes with the same entitlements', heard(w2, 'wolves', 'p03'), JSON.stringify(w2.energy.wolves));
  }

  console.log('\nRESULTS\n' + Object.entries(results).map(([k, v]) => `${v.padEnd(5)} ${k}`).join('\n'));
  await test.info().attach('results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
