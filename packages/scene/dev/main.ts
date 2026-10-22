// Dev harness: runs the scene against the fixture stub server (no real server). Also the capture/perf target.
// URL: ?theme=halloween (theme option; window.__moonveil.setTheme('normal'|'halloween') at runtime)  ?outfit=<id>&variant=&hat=&front=&back=&color= (costume preview)  ?scene=lobby|seating|night|day|ghost|ended  ?quality=off|low|high|auto (default high)  ?labels=0|1|2 (off | v1: lift ≤3 no leaders | default v2)  ?n=4..16  ?viewer=moderator|s1..s16  ?cam=fit|tight  ?panel=0  ?audio=0  ?speak=0  ?perf=1
import { mountScene } from '../src/index.ts';
import { phaseLabel } from '../src/choreo.ts';
import { FakeServer, type FixtureScene } from '../fixtures/index.ts';
import type { SceneHandle, SceneInput, Pose } from '../src/types.ts';
import { Hud } from './hud.ts';

const q = new URLSearchParams(location.search);
const n = Math.max(4, Math.min(16, parseInt(q.get('n') ?? '10', 10) || 10));
const initial = (q.get('scene') as FixtureScene) || 'lobby';
const viewerParam = q.get('viewer');
const viewer = viewerParam === 'moderator' ? 'moderator' : viewerParam && /^s\d+$/.test(viewerParam) ? viewerParam : undefined;   // seat id, e.g. s1

const server = new FakeServer(initial, n, viewer);
// Dress every seat: ?outfit=duck &variant=ring|plain &hat=duckCap|none &front=.. &back=.. &color=sand
// Scene-side fields only; the wire contract is foundation's.
const outfitId = q.get('outfit');
if (outfitId) {
  const pick = (k: string) => q.get(k) ?? undefined;
  server.input = { ...server.input, players: server.input.players.map((p) => ({ ...p, appearance: { ...p.appearance, outfit: outfitId, variant: pick('variant'), hat: (pick('hat') ?? p.appearance.hat) as typeof p.appearance.hat, front: pick('front'), back: pick('back'), top: (pick('color') ?? p.appearance.top) as typeof p.appearance.top } })) };
}
if (q.get('speak') === '0') server.autoSpeak = false;
const host = document.getElementById('scene')!;
// experimental cost knobs: ?x=aa0,fps15,lmc,rip0,vig0 (A/B measurement only)
const xs = new Set((q.get('x') ?? '').split(',').filter(Boolean));
const fpsX = [...xs].find((k) => k.startsWith('fps'));
const experimental = { antialias: xs.has('aa0') ? false : undefined, fpsCap: fpsX ? parseInt(fpsX.slice(3), 10) : undefined, lightmapOnChange: xs.has('lmc') || undefined, ripples: xs.has('rip0') ? false : undefined, vignette: xs.has('vig0') ? false : undefined };
const scene: SceneHandle = mountScene(host, { experimental, debug: true, ...(q.get('theme') === 'halloween' ? { theme: 'halloween' as const } : {}), input: server.input, camera: (q.get('cam') as 'fit' | 'tight') || undefined, perf: q.get('perf') === '1', quality: (q.get('quality') as 'off' | 'low' | 'high' | 'auto') || 'high', labelLayout: q.get('labels') === '0' ? false : q.get('labels') === '1' ? 'v1' : true });
server.onPoses((f) => scene.setPoses(f));
server.onSpeaking((s) => scene.setSpeaking(s));
scene.on('move', (p: Pose) => { server.move(p.seat, p.x, p.y, p.facing); });

const hud = new Hud(document.body, {
  setScene: (s) => { server.setScene(s); scene.setInput(server.input); banner(s); },
  setSpeak: (on) => scene.setSpeakingLocal(on),
  setAutoSpeak: (on) => { server.autoSpeak = on; },
  setAudio: (on) => scene.setAudio(on),
  emote: () => scene.emote('👋'),
  setCamera: (m) => scene.setCamera(m),
}, { panel: q.get('panel') !== '0', touch: navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches });
hud.markScene(initial); hud.markCam(q.get('cam') === 'tight' ? 'tight' : window.innerHeight > window.innerWidth * 1.1 && window.innerWidth < 600 ? 'tight' : 'fit');
scene.setSafeArea({ top: 56 });

const BANNERS: Record<FixtureScene, [string, string]> = {
  lobby: ['Lobby', 'Walk around the camp while everyone arrives'], seating: ['Day 1', 'Gather around the fire'], night: ['Night falls', 'Everyone returns to their tent'],
  day: ['Dawn', 'Day 2 — back to the fire'], ghost: ['You are a ghost', 'Drift anywhere. Only other ghosts can see you'], ended: ['Match over', 'Roles revealed'],
};
let bannerTimer = 0;
function banner(s: FixtureScene) { const b = BANNERS[s]; hud.banner({ title: b[0], sub: b[1] }); clearTimeout(bannerTimer); bannerTimer = window.setTimeout(() => hud.banner(null), s === 'night' || s === 'day' ? 4000 : 2800); }
banner(initial);

if (q.get('audio') !== '0') {
  const start = async () => { await scene.setAudio(true); hud.markAudio(true); };
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
  if (!q.has('scene')) hud.toast('Tap or press a key to start the ambience', 4000);
}

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  server.update(dt);
  const inp: SceneInput = server.input;
  const alive = inp.seats.length ? inp.seats.filter((s) => s.alive).length : inp.players.length;
  hud.setPhase(phaseLabel(inp), inp.phase === 'lobby' ? `· ${inp.players.length} campers` : inp.me.kind === 'moderator' ? '· moderator' : inp.seats.find((s) => s.seat === inp.me.seat)?.alive === false ? '· ghost view' : `· ${alive} alive`, inp.phase === 'night');
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// automation hooks for captures / perf
declare global { interface Window { __moonveil?: Record<string, unknown> } }
window.__moonveil = {
  setScene: (s: FixtureScene, dead?: string[]) => { server.setScene(s, dead); scene.setInput(server.input); hud.markScene(s); banner(s); },
  dead: () => server.input.seats.filter((x) => !x.alive).map((x) => x.seat),
  setSpeak: (on: boolean) => { scene.setSpeakingLocal(on); hud.setMic(on); },
  setCamera: (m: 'fit' | 'tight') => { scene.setCamera(m); hud.markCam(m); },
  walk: (x: number, y: number) => scene.walkLocal(x, y),
  emote: (s: string) => scene.emote(s),
  night: () => scene.night(),
  localPose: () => scene.localPose(),
  // simulate "save a new look" for a seat: the stub server updates the snapshot and the scene re-bakes that avatar
  // local-only draft of my look (editor preview): patch merges into the snapshot appearance; null clears
  setLocalLook: (patch: Record<string, string> | null) => { const me = server.input.players.find((p) => p.seat === server.input.me.seat); scene.setLocalAppearanceOverride(patch && me ? ({ ...me.appearance, ...patch } as typeof me.appearance) : null); },
  debugAppearance: (seat: string) => scene.debugAppearance(seat),
  debugCamera: () => scene.debugCamera(),
  debugLabels: () => scene.debugLabels(),
  debugTheme: () => scene.debugTheme(),
  setTheme: (t: 'normal' | 'halloween') => scene.setTheme(t),
  setLook: (seat: string, patch: Record<string, string>) => { server.input = { ...server.input, players: server.input.players.map((p) => (p.seat === seat ? { ...p, appearance: { ...p.appearance, ...patch } } : p)) }; scene.setInput(server.input); },
  time: () => scene.time(),
  perf: () => scene.perf(),
  perfReset: () => scene.perfReset(),
  ready: false,
  quality: scene.quality,
};
void scene.ready.then(() => { window.__moonveil!.ready = true; console.log(`moonveil scene harness: ${n} players, ${initial}`); });
