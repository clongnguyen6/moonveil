// mountScene: the renderer. Consumes SceneInput snapshots + server-filtered PoseFrames + local input.
import { Application, Container, Sprite } from 'pixi.js';
import { TextureBank } from './textures.ts';
import { World } from './world.ts';
import { Avatar } from './avatar.ts';
import { Lighting } from './lighting.ts';
import { Fire, Fireflies, WaterGlints, Fog } from './particles.ts';
import { Input } from './input.ts';
import { Ambience } from './audio.ts';
import { PoseBuffer } from './poses.ts';
import { createMap, frameRect, FIRE, WORLD, inWorld, type MapLayout } from './map.ts';
import { intentFor, canMove, nightLevelFor, type SeatIntent } from './choreo.ts';
import { lerp, clamp, mixColor, smooth } from './rng.ts';
import type { CameraMode, Pose, PoseFrame, SafeArea, SceneHandle, SceneInput, SceneOptions, SeatId, PerfStats } from './types.ts';

const NIGHT_SPEED = 1 / 7;   // full day↔night transition in 7 s
const MOVE_SEND_HZ = 10;

type Listener = { move: ((p: Pose) => void)[]; emote: ((e: string) => void)[] };

export function mountScene(host: HTMLElement, opts: SceneOptions): SceneHandle {
  let input = opts.input;
  let destroyed = false;
  const listeners: Listener = { move: [], emote: [] };
  const poses = new PoseBuffer();
  let speakingSet = new Set<SeatId>();
  let localSpeaking = false;
  let cameraMode: CameraMode = opts.camera ?? (window.innerHeight > window.innerWidth * 1.1 && window.innerWidth < 600 ? 'tight' : 'fit');
  const safe: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  const perfOn = !!opts.perf;
  const perf = { frames: [] as number[], update: [] as number[], lightmap: [] as number[], render: [] as number[], last: 0 };
  let t = 0;
  let nightLevel = nightLevelFor(input.phase);
  let app: Application | null = null;
  let pendingInput: SceneInput | null = null;
  let walkLocalReq: { x: number; y: number } | null = null;
  let emoteReq: string | null = null;
  const ambience = new Ambience();

  const ready = (async () => {
    const a = new Application();
    await a.init({
      resizeTo: host, background: '#0f1813', antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, opts.resolution ?? 2), autoDensity: true,
      preference: 'webgl', powerPreference: 'high-performance',
    });
    if (destroyed) { a.destroy(true); return; }
    app = a;
    a.canvas.style.display = 'block';
    a.canvas.style.touchAction = 'none';
    host.appendChild(a.canvas);
    build(a);
  })();

  // ---- scene graph (built once Pixi is ready) ----
  let map: MapLayout;
  let world: World;
  let bank: TextureBank;
  let emissive: Container, fx: Container, lighting: Lighting, vignette: Sprite, nightTint: Sprite;
  let fire: Fire, fireflies: Fireflies, glints: WaterGlints, fog: Fog;
  let fireLight: Sprite, fireLight2: Sprite, moon: Sprite, moonEdge: Sprite;
  let tentLights: Sprite[] = [], tentBulbs: Sprite[] = [], postLights: Sprite[] = [], postBulbs: Sprite[] = [];
  const lanternLevel: number[] = [];
  let inputCtl: Input;
  const avatars = new Map<SeatId, Avatar>();
  const intents = new Map<SeatId, SeatIntent['kind']>();
  const fades: { a: Avatar; to: number; speed: number; done?: () => void }[] = [];
  const timers: { t: number; fn: () => void }[] = [];
  let snap = true;
  const cam = { x: 0, y: 0, scale: 1 };
  const follow: { x: number; y: number } = { x: FIRE.x, y: FIRE.y };
  let moveAcc = 0;
  let lastSent: Pose | null = null;

  function build(a: Application) {
    bank = new TextureBank(a.renderer);
    map = createMap(Math.max(4, input.players.length));
    world = new World(bank, map);
    emissive = new Container(); fx = new Container();
    lighting = new Lighting(a.renderer, bank.light);
    vignette = new Sprite(bank.vignette); vignette.alpha = 0.9;
    nightTint = new Sprite(bank.light); nightTint.tint = 0x6a5aa8; nightTint.alpha = 0; nightTint.anchor.set(0.5); // soft purple wash at night
    a.stage.addChild(world.root, lighting.out, nightTint, emissive, fx, vignette);

    fireLight = lighting.addLight(0xffa84a, 3.2); fireLight2 = lighting.addLight(0xff7a30, 1.4);
    fireLight.position.set(FIRE.x, FIRE.y - 10); fireLight2.position.set(FIRE.x, FIRE.y - 10);
    moon = lighting.addLight(0x8690ff, 9, 0); moon.position.set(FIRE.x + 150, FIRE.y - 120);
    moonEdge = lighting.addLight(0x6060c8, 16, 0); moonEdge.position.set(FIRE.x, FIRE.y);
    tentLights = map.tents.map((tn) => { const l = lighting.addLight(0xffa858, 1.0, 0); l.position.set(tn.lanternAt.x, tn.lanternAt.y + 20); return l; });
    tentBulbs = map.tents.map((tn) => { const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xffd890; s.position.set(tn.x + 4, tn.y - 34); s.scale.set(0.5); s.alpha = 0; emissive.addChild(s); return s; });
    postLights = world.lanternBulbs.map((p) => { const l = lighting.addLight(0xffb066, 1.4, 0); l.position.set(p.x, p.y + 10); return l; });
    postBulbs = world.lanternBulbs.map((p) => { const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xffe0a0; s.position.set(p.x, p.y); s.scale.set(0.6); s.alpha = 0; emissive.addChild(s); return s; });
    for (let i = 0; i < map.tents.length; i++) lanternLevel.push(0);
    fire = new Fire(emissive, fx, bank); fireflies = new Fireflies(emissive, bank); glints = new WaterGlints(emissive, bank); fog = new Fog(fx, bank);

    inputCtl = new Input(host);
    inputCtl.onSpeakKey = (down) => { localSpeaking = down; };

    if (perfOn) {
      let stageStart = 0;
      a.ticker.add(() => { const now = performance.now(); if (perf.last) perf.frames.push(now - perf.last); perf.last = now; stageStart = now; }, undefined, 100);
      a.ticker.add(() => { const now = performance.now(); perf.update.push(now - stageStart - lightMs); perf.lightmap.push(lightMs); stageStart = now; }, undefined, -1);
      a.ticker.add(() => { perf.render.push(performance.now() - stageStart); }, undefined, -100);
    }
    applyInput(input, true);
    let lastW = 0, lastH = 0;
    a.ticker.add((tk) => {
      const dt = Math.min(0.1, tk.deltaMS / 1000);
      t += dt;
      const vw = a.screen.width, vh = a.screen.height;
      if (vw !== lastW || vh !== lastH) { lighting.resize(vw, vh); lastW = vw; lastH = vh; }
      if (pendingInput) { const p = pendingInput; pendingInput = null; applyInput(p, false); }
      inputCtl.update();
      layoutCamera(dt, vw, vh);
      tick(dt);
      lightMs = 0; const l0 = performance.now(); lighting.render(cam); lightMs = performance.now() - l0;
    });
  }
  let lightMs = 0;

  function after(sec: number, fn: () => void) { timers.push({ t: sec, fn }); }
  function fade(av: Avatar, to: number, sec: number, done?: () => void) {
    const i = fades.findIndex((f) => f.a === av); if (i >= 0) fades.splice(i, 1);
    fades.push({ a: av, to, speed: 1 / sec, done });
  }

  // Reconcile avatars and intents with a new snapshot. `snapNow` = place without animation (first input, reconnect).
  function applyInput(next: SceneInput, snapNow: boolean) {
    const prev = input; input = next;
    if (next.players.length !== prev.players.length && map && next.players.length > map.playerCount) {
      // more players than tents/seats: rebuild layout (lobby only in practice)
      rebuildMap(next.players.length);
    }
    // create / remove avatars
    const seen = new Set<SeatId>();
    next.players.forEach((p) => {
      seen.add(p.seat);
      let av = avatars.get(p.seat);
      if (!av) {
        av = new Avatar(p.seat, p.name, p.appearance, bank);
        world.objects.addChild(av.root); emissive.addChild(av.glow, ...av.wisps);
        avatars.set(p.seat, av);
        av.mode = 'hidden'; // until positioned
      }
      av.setName(p.name + (next.reveal?.[p.seat] ? ` · ${next.reveal[p.seat]}` : ''));
    });
    for (const [seat, av] of avatars) if (!seen.has(seat)) { av.destroy(); avatars.delete(seat); intents.delete(seat); poses.drop(seat); }
    const nightNow = nightLevelFor(next.phase);
    if (snapNow) nightLevel = nightNow;
    // intents
    const phaseChanged = prev.phase !== next.phase;
    for (const p of next.players) {
      const av = avatars.get(p.seat)!;
      const intent = intentFor(next, p.seat);
      const before = intents.get(p.seat);
      if (before === intent.kind && !(snapNow)) continue;
      intents.set(p.seat, intent.kind);
      av.target = null; av.onArrive = null;
      const i = fades.findIndex((f) => f.a === av); if (i >= 0) fades.splice(i, 1);
      const local = p.seat === next.me.seat;
      switch (intent.kind) {
        case 'free': {
          av.mode = 'idle'; av.alpha = 1;
          if (local && (snapNow || before === undefined)) { const s = map.seats[0]!; av.setPos(FIRE.x - 40, FIRE.y + 200); void s; }
          if (!local) av.mode = poses.has(p.seat) ? 'idle' : 'hidden';
          break;
        }
        case 'seat': {
          const seat = map.seats[intent.index] ?? map.seats[0]!;
          const face: 1 | -1 = seat.sit.x < FIRE.x ? 1 : -1;
          const fromTent = before === 'tent';
          if (snapNow || !fromTent && before === undefined || before === 'ghost') { av.mode = 'seated'; av.alpha = 1; av.setPos(seat.sit.x, seat.sit.y); av.facing = face; break; }
          const idx = intent.index;
          if (fromTent) {
            const tent = map.tents[idx] ?? map.tents[0]!;
            av.mode = 'hidden'; av.alpha = 0; av.setPos(tent.door.x, tent.door.y);
            after(2.5 + idx * 0.3, () => { av.mode = 'idle'; lanternLevel[idx] = 0; fade(av, 1, 0.5); after(0.4, () => av.walkTo(seat.sit.x, seat.sit.y, () => { av.mode = 'seated'; av.facing = face; })); });
          } else {
            if (av.mode === 'hidden') { av.setPos(seat.sit.x, seat.sit.y + 160); }
            av.mode = 'idle'; av.alpha = 1;
            after(idx * 0.1, () => av.walkTo(seat.sit.x, seat.sit.y, () => { av.mode = 'seated'; av.facing = face; }));
          }
          break;
        }
        case 'tent': {
          const idx = intent.index; const tent = map.tents[idx] ?? map.tents[0]!;
          if (snapNow) { av.mode = 'hidden'; av.alpha = 0; av.setPos(tent.door.x, tent.door.y); lanternLevel[idx] = 0.4; break; }
          av.mode = 'idle'; av.alpha = 1;
          if (before === undefined) av.setPos(map.seats[idx]?.sit.x ?? FIRE.x, map.seats[idx]?.sit.y ?? FIRE.y + 150);
          after(1.2 + idx * 0.25, () => av.walkTo(tent.door.x, tent.door.y, () => {
            lanternLevel[idx] = 1;
            fade(av, 0, 0.5, () => { av.mode = 'hidden'; });
            after(1.6, () => { lanternLevel[idx] = 0.4; });
          }));
          break;
        }
        case 'ghost': {
          av.mode = 'ghost'; av.alpha = 1; av.speed = 150;
          if (local) { if (snapNow || before !== 'ghost') { const s = map.seats[next.players.indexOf(p)] ?? map.seats[0]!; av.setPos(s.sit.x, s.sit.y); } }
          else if (!poses.has(p.seat)) av.mode = 'hidden';
          break;
        }
        case 'absent': av.mode = 'hidden'; break;
      }
    }
    if (phaseChanged && next.phase !== 'night') for (let i = 0; i < lanternLevel.length; i++) if (lanternLevel[i] === 0.4 && !snapNow) { /* dawn: lanterns go out as players emerge */ }
    if (next.phase !== 'night' && snapNow) lanternLevel.fill(0);
    snap = false;
  }

  function rebuildMap(n: number) {
    // Lobby growth beyond the initial layout: rebuild world and lights. Rare; acceptable cost.
    const a = app!; const old = world;
    map = createMap(n);
    world = new World(bank, map);
    a.stage.addChildAt(world.root, 0);
    for (const av of avatars.values()) world.objects.addChild(av.root);
    old.root.destroy({ children: true });
    for (const l of tentLights) l.destroy(); for (const b of tentBulbs) b.destroy();
    tentLights = map.tents.map((tn) => { const l = lighting.addLight(0xffa858, 1.0, 0); l.position.set(tn.lanternAt.x, tn.lanternAt.y + 20); return l; });
    tentBulbs = map.tents.map((tn) => { const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xffd890; s.position.set(tn.x + 4, tn.y - 34); s.scale.set(0.5); s.alpha = 0; emissive.addChild(s); return s; });
    lanternLevel.length = 0; for (let i = 0; i < map.tents.length; i++) lanternLevel.push(0);
  }

  function layoutCamera(dt: number, vw: number, vh: number) {
    const fr = frameRect(map);
    const innerW = Math.max(100, vw - safe.left - safe.right), innerH = Math.max(100, vh - safe.top - safe.bottom);
    const fit = Math.min(innerW / fr.w, innerH / fr.h);
    const portrait = vh > vw * 1.1;
    let scale = fit;
    let cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2;
    if (cameraMode === 'tight' && portrait) {
      scale = Math.max(fit, innerH / 1150);
      const me = avatars.get(input.me.seat);
      const visible = !!me && me.mode !== 'hidden';
      const tx = visible ? me.x : fr.x + fr.w / 2, ty = visible ? me.y - 40 : FIRE.y - 60;
      follow.x = lerp(follow.x, tx, clamp(dt * 1.5, 0, 1)); follow.y = lerp(follow.y, ty, clamp(dt * 1.5, 0, 1));
      const halfW = innerW / scale / 2, halfH = innerH / scale / 2;
      cx = clamp(follow.x, fr.x + halfW - 120, fr.x + fr.w - halfW + 120);
      cy = clamp(follow.y, fr.y - 120 + halfH, WORLD.h + 40 - halfH);
    }
    cam.scale = scale;
    cam.x = safe.left + innerW / 2 - cx * scale;
    cam.y = safe.top + innerH / 2 - cy * scale;
    for (const c of [world.root, emissive, fx]) { c.position.set(cam.x, cam.y); c.scale.set(scale); }
    vignette.width = vw; vignette.height = vh;
    nightTint.position.set(vw / 2, vh / 2); nightTint.scale.set(Math.max(vw, vh) / 256 * 1.6);
  }

  function tick(dt: number) {
    // timers and fades
    for (const tm of timers) tm.t -= dt;
    const due = timers.filter((x) => x.t <= 0); for (let i = timers.length - 1; i >= 0; i--) if (timers[i]!.t <= 0) timers.splice(i, 1);
    for (const d of due) d.fn();
    for (const f of fades.slice()) {
      const av = f.a; av.alpha = av.alpha < f.to ? Math.min(f.to, av.alpha + dt * f.speed) : Math.max(f.to, av.alpha - dt * f.speed);
      if (av.alpha === f.to) { const i = fades.indexOf(f); if (i >= 0) fades.splice(i, 1); f.done?.(); }
    }
    // lighting mix
    const target = nightLevelFor(input.phase);
    const d = target - nightLevel;
    nightLevel = Math.abs(d) < dt * NIGHT_SPEED ? target : nightLevel + Math.sign(d) * dt * NIGHT_SPEED;
    const n = nightLevel, moonL = clamp((n - 0.4) / 0.6, 0, 1);
    const labelScale = clamp(1 / cam.scale, 1, 3.2) * (cam.scale < 0.65 ? 0.8 : 1);
    const now = performance.now();

    // avatars
    const meSeat = input.me.seat;
    const localMayMove = canMove(input, meSeat);
    for (const p of input.players) {
      const av = avatars.get(p.seat)!;
      const local = p.seat === meSeat;
      const kind = intents.get(p.seat);
      av.speaking = speakingSet.has(p.seat) || (local && localSpeaking);
      if (kind === 'ghost' || kind === 'free') {
        if (local) {
          if (walkLocalReq) { av.walkTo(walkLocalReq.x, walkLocalReq.y); walkLocalReq = null; }
          av.update(dt, labelScale, localMayMove ? inputCtl.dir : undefined, av.mode === 'ghost' ? undefined : world.walkable);
          if (av.mode === 'ghost' && !inWorld(av.x, av.y)) { av.x = clamp(av.x, -200, WORLD.w + 200); av.y = clamp(av.y, -200, WORLD.h + 200); }
        } else {
          const s = poses.sample(p.seat, now);
          if (s && poses.fresh(p.seat, now)) { if (av.mode === 'hidden') av.mode = kind === 'free' ? 'idle' : 'ghost'; av.applyPose(s.x, s.y, s.facing, s.moving, dt, labelScale); }
          else if (s && kind === 'free') { av.applyPose(s.x, s.y, s.facing, false, dt, labelScale); }   // lobby: stale = frozen in place
          else if (kind === 'ghost') { av.mode = 'hidden'; av.update(dt, labelScale); }                   // ghosts vanish when no entitled pose arrives
          else av.update(dt, labelScale);
        }
      } else av.update(dt, labelScale, undefined, world.walkable);
      if (local && emoteReq) { av.showEmote(emoteReq); emoteReq = null; }
    }
    // emit own pose at ≤10 Hz when it changed
    const me = avatars.get(meSeat);
    moveAcc += dt;
    if (me && localMayMove && moveAcc >= 1 / MOVE_SEND_HZ) {
      moveAcc = 0;
      const pose: Pose = { seat: meSeat, x: Math.round(me.x), y: Math.round(me.y), facing: me.facing, moving: me.mode === 'walk' || (!!inputCtl.dir.x || !!inputCtl.dir.y) };
      if (!lastSent || lastSent.x !== pose.x || lastSent.y !== pose.y || lastSent.facing !== pose.facing || lastSent.moving !== pose.moving) { lastSent = pose; for (const cb of listeners.move) cb(pose); }
    }

    // world + effects
    world.update(t, dt);
    const fi = lerp(1, 0.45, smooth(n));
    const flick = 1 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 23.7) * 0.03 + Math.sin(t * 3.1) * 0.03;
    fire.intensity = fi;
    fireLight.scale.set(3.4 * flick * (0.7 + 0.3 * fi)); fireLight.alpha = 0.85 * (0.5 + 0.5 * fi);
    fireLight2.scale.set(1.5 * flick); fireLight2.alpha = 0.9;
    moon.alpha = 0.7 * moonL; moonEdge.alpha = 0.45 * moonL;
    tentLights.forEach((l, i) => { const lv = (lanternLevel[i] ?? 0) * (0.8 + Math.sin(t * 6 + i) * 0.08); l.alpha = lv * 0.9; const b = tentBulbs[i]; if (b) { b.alpha = lv * 0.9; b.scale.set(0.45 + lv * 0.2); } });
    postLights.forEach((l, i) => { l.alpha = moonL * (0.75 + Math.sin(t * 5 + i * 2) * 0.1); const b = postBulbs[i]; if (b) b.alpha = moonL * 0.95; });
    fireflies.level = moonL; fireflies.update(t);
    glints.night = moonL; glints.update(t);
    fog.level = moonL * 0.45; fog.update(t);
    fire.update(t, dt, mixColor(0xffffff, 0x5a6090, n));
    lighting.ambient = ambientColor(n);
    nightTint.alpha = 0.16 * moonL;
    vignette.alpha = 0.75 + 0.25 * n;
    ambience.night = n; ambience.fire = fi; ambience.update(dt);
  }

  function ambientColor(nl: number): number {
    const s = smooth(nl);
    const day = 0xffffff, dusk = 0xe8a070, night = 0x3a3c92;
    return s < 0.5 ? mixColor(day, dusk, s * 2) : mixColor(dusk, night, (s - 0.5) * 2);
  }

  const stat = (arr: number[]) => { const s = [...arr].sort((x, y) => x - y); const n = s.length || 1; return { avg: +(arr.reduce((x, y) => x + y, 0) / n).toFixed(2), p95: +(s[Math.floor(n * 0.95)] ?? 0).toFixed(2), max: +(s[n - 1] ?? 0).toFixed(2) }; };

  const handle: SceneHandle = {
    ready,
    setInput(next) { if (!app) { input = next; snap = true; } else pendingInput = next; },
    setPoses(frame: PoseFrame) { poses.push(frame, performance.now()); },
    setSpeaking(seats) { speakingSet = new Set(seats); },
    on(event: 'move' | 'emote', cb: ((p: Pose) => void) | ((e: string) => void)) {
      const arr = listeners[event] as unknown[]; arr.push(cb);
      return () => { const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1); };
    },
    emote(e) { emoteReq = e; for (const cb of listeners.emote) cb(e); },
    setSpeakingLocal(on) { localSpeaking = on; },
    async setAudio(on) { if (on) await ambience.enable(); else ambience.disable(); },
    setCamera(mode) { cameraMode = mode; },
    setSafeArea(insets) { Object.assign(safe, insets); },
    time: () => t,
    perf: (): PerfStats | null => perfOn ? { n: perf.frames.length, frame: stat(perf.frames), update: stat(perf.update), lightmap: stat(perf.lightmap), render: stat(perf.render) } : null,
    perfReset() { perf.frames.length = perf.update.length = perf.lightmap.length = perf.render.length = 0; },
    walkLocal(x, y) { walkLocalReq = { x, y }; },
    night: () => nightLevel,
    destroy() {
      destroyed = true;
      ambience.disable();
      if (app) { inputCtl?.detach(); for (const av of avatars.values()) av.destroy(); app.destroy(true, { children: true }); app = null; }
    },
  };
  void snap;
  return handle;
}
