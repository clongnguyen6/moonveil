// mountScene: the renderer. Consumes SceneInput snapshots + server-filtered PoseFrames + local input.
import { Application, Container, Sprite, TilingSprite } from 'pixi.js';
import { TextureBank } from './textures.ts';
import { World } from './world.ts';
import { Avatar } from './avatar.ts';
import { Lighting } from './lighting.ts';
import { Fire, Fireflies, WaterGlints, Mist } from './particles.ts';
import { Input } from './input.ts';
import { Ambience } from './audio.ts';
import { PoseBuffer } from './poses.ts';
import { createMap, frameRect, FIRE, WORLD, inWorld, streamX, type MapLayout } from './map.ts';
import { intentFor, canMove, nightLevelFor, type SeatIntent } from './choreo.ts';
import { lerp, clamp, mixColor, smooth } from './rng.ts';
import type { CameraMode, Pose, PoseFrame, SafeArea, SceneHandle, SceneInput, SceneOptions, SeatId, PerfStats } from './types.ts';
import { resolveQuality, frameCap, readQualityEnv } from './quality.ts';

const NIGHT_SPEED = 1 / 7;   // full day↔night transition in 7 s
const MOVE_SEND_HZ = 10;

type Listener = { move: ((p: Pose) => void)[]; emote: ((e: string) => void)[]; tap: ((p: { x: number; y: number; seat: SeatId | null }) => void)[] };

// 'off': nothing is mounted; every method is a no-op. Lets harnesses keep the shell's mount code unchanged.
function offHandle(input: SceneInput): SceneHandle {
  let inp = input;
  return {
    ready: Promise.resolve(), quality: 'off',
    setInput(next) { inp = next; }, setPoses() {}, setSpeaking() {}, on() { return () => {}; }, emote() {}, setSpeakingLocal() {},
    async setAudio() {}, setCamera() {}, setSafeArea() {}, resize() {},
    time: () => 0, perf: () => null, perfReset() {}, walkLocal() {}, localPose: () => null, night: () => (inp.phase === 'night' ? 1 : 0), destroy() {},
  };
}

export function mountScene(host: HTMLElement, opts: SceneOptions): SceneHandle {
  const qEnv = readQualityEnv(globalThis);
  const quality = resolveQuality(opts.quality, qEnv);
  if (quality === 'off') return offHandle(opts.input);
  const reducedMotion = !!qEnv.reducedMotion;
  const low = quality === 'low';
  let input = opts.input;
  let destroyed = false;
  const listeners: Listener = { move: [], emote: [], tap: [] };
  const poses = new PoseBuffer();
  let speakingSet = new Set<SeatId>();
  let localSpeaking = false;
  const hostW = () => host.clientWidth || window.innerWidth, hostH = () => host.clientHeight || window.innerHeight;
  let cameraMode: CameraMode = opts.camera ?? (hostH() > hostW() * 1.1 && hostW() < 600 ? 'tight' : 'fit');
  let ro: ResizeObserver | null = null;
  let onVis: (() => void) | null = null;
  let frameNo = 0;
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
      resizeTo: host, background: '#0b0f14', antialias: true,
      resolution: low ? 1 : Math.min(window.devicePixelRatio || 1, opts.resolution ?? 2), autoDensity: true,
      preference: 'webgl', powerPreference: 'high-performance',
    });
    if (destroyed) { a.destroy(true); return; }
    app = a;
    a.ticker.maxFPS = frameCap(quality, reducedMotion);
    // no frames while the document is hidden (background tab, headless page marked hidden)
    onVis = () => { if (document.hidden) a.ticker.stop(); else a.ticker.start(); };
    document.addEventListener('visibilitychange', onVis);
    if (document.hidden) a.ticker.stop();
    a.canvas.style.display = 'block';
    a.canvas.style.touchAction = 'none';
    host.appendChild(a.canvas);
    build(a);
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => a.resize()); ro.observe(host); }
  })();

  // ---- scene graph (built once Pixi is ready) ----
  let map: MapLayout;
  let world: World;
  let bank: TextureBank;
  let emissive: Container, warm: Container, fx: Container, lighting: Lighting, vignette: Sprite, grain: TilingSprite | null = null;
  const foreground: Sprite[] = [];
  let fire: Fire, fireflies: Fireflies, glints: WaterGlints, mist: Mist;
  let fireLight: Sprite, fireLight2: Sprite, firePool: Sprite, moon: Sprite, moonWaterRef: Sprite | null = null;
  let tentLights: Sprite[] = [], tentPools: Sprite[] = [], tentReflections: (Sprite | null)[] = [], postLights: Sprite[] = [], postBulbs: Sprite[] = [], postReflections: (Sprite | null)[] = [];
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
    bank = new TextureBank(a.renderer, low);
    map = createMap(Math.max(4, input.players.length));
    world = new World(bank, map, low);
    emissive = new Container(); warm = new Container(); fx = new Container();
    lighting = new Lighting(a.renderer, bank.light);
    vignette = new Sprite(bank.vignette);
    // layers: painted world → multiply lightmap (shapes the dark) → warm additive pools (lift near fire/lamps)
    //         → emissive (flames, embers, bulbs, reflections) → fx (mist, smoke) → vignette → grain
    a.stage.addChild(world.root, lighting.out, warm, emissive, fx, vignette);
    // screen-space framing: dark foliage in the bottom-left and top-right corners (depth cue, cheap)
    bank.foreground.forEach((tex, i) => { const f = new Sprite(tex); f.anchor.set(i === 0 ? 0 : 1, i === 0 ? 1 : 0); f.alpha = 0.9; foreground.push(f); fx.addChild(f); });
    if (!low) { grain = new TilingSprite({ texture: bank.grain, width: 64, height: 64 }); grain.blendMode = 'add'; grain.alpha = 0.028; a.stage.addChild(grain); }

    fireLight = lighting.addLight(0xffb070, 3.4); fireLight2 = lighting.addLight(0xff8a40, 1.3);
    fireLight.position.set(FIRE.x, FIRE.y - 6); fireLight2.position.set(FIRE.x, FIRE.y - 6);
    firePool = new Sprite(bank.light); firePool.anchor.set(0.5); firePool.blendMode = 'add'; firePool.tint = 0xff8c3a; firePool.position.set(FIRE.x, FIRE.y + 10); firePool.scale.set(3.4, 2.1); warm.addChild(firePool);
    const moonWater = new Sprite(bank.lightSoft); moonWater.anchor.set(0.5); moonWater.blendMode = 'add'; moonWater.tint = 0x5a6e8c; moonWater.position.set(streamX(420), 420); moonWater.scale.set(3.2, 5); moonWater.alpha = 0; warm.addChild(moonWater); moonWaterRef = moonWater;
    moon = lighting.addLight(0x9aa6c8, 12, 0); moon.position.set(FIRE.x + 420, FIRE.y - 300);
    buildTentLights();
    postLights = world.lanternBulbs.map((p) => { const l = lighting.addLight(0xffb066, 1.0, 0); l.position.set(p.x, p.y + 14); return l; });
    postBulbs = world.lanternBulbs.map((p) => { const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xffd9a0; s.position.set(p.x, p.y); s.scale.set(0.35); s.alpha = 0; emissive.addChild(s); return s; });
    postReflections = world.lanternBulbs.map((p) => reflectionFor(p.x, p.y, 0xffc080));
    fire = new Fire(emissive, fx, bank); fireflies = new Fireflies(emissive, bank); glints = new WaterGlints(emissive, bank); mist = new Mist(fx, bank, low ? 2 : 6);

    inputCtl = new Input(host);
    inputCtl.onSpeakKey = (down) => { localSpeaking = down; };
    // tap-to-walk: second movement intent (phones without a joystick habit, laptops with a trackpad)
    inputCtl.onTap = (sx, sy) => {
      const wx = (sx - cam.x) / cam.scale, wy = (sy - cam.y) / cam.scale;
      let seat: SeatId | null = null, best = 48;
      for (const av of avatars.values()) { if (!av.root.visible) continue; const d = Math.hypot(av.x - wx, av.y - 40 - wy); if (d < best) { best = d; seat = av.seat; } }
      for (const cb of listeners.tap) cb({ x: wx, y: wy, seat });
      if (!seat && canMove(input, input.me.seat)) walkLocalReq = { x: wx, y: wy };
    };

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
      frameNo++;
      lightMs = 0;
      if (!low || frameNo % 2 === 0) { const l0 = performance.now(); lighting.render(cam); lightMs = performance.now() - l0; }
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
    // Lobby growth beyond the initial layout: rebuild world and tent lights. Rare; acceptable cost.
    const a = app!; const old = world;
    map = createMap(n);
    world = new World(bank, map, low);
    a.stage.addChildAt(world.root, 0);
    for (const av of avatars.values()) world.objects.addChild(av.root);
    old.root.destroy({ children: true });
    buildTentLights();
  }

  function buildTentLights() {
    for (const l of tentLights) l.destroy(); for (const p of tentPools) p.destroy(); for (const r of tentReflections) r?.destroy();
    tentLights = map.tents.map((tn) => { const l = lighting.addLight(0xffb070, 0.8, 0); l.position.set(tn.x + 2, tn.y - 10); return l; });
    tentPools = map.tents.map((tn) => { const s = new Sprite(bank.lightSoft); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xff9a50; s.position.set(tn.x + 2, tn.y + 4); s.scale.set(0.7, 0.4); s.alpha = 0; warm.addChild(s); return s; });
    tentReflections = map.tents.map((tn) => reflectionFor(tn.x, tn.y, 0xffb070));
    lanternLevel.length = 0; for (let i = 0; i < map.tents.length; i++) lanternLevel.push(0);
  }
  // a warm light near the stream shows as a vertical streak on the water
  function reflectionFor(x: number, y: number, tint: number): Sprite | null {
    const sx = streamX(y);
    if (x > sx - 420 && x < sx + 100) {
      const s = new Sprite(bank.streak); s.anchor.set(0.5, 0); s.blendMode = 'add'; s.tint = tint; s.position.set(sx + (x - sx) * 0.12, y + 30); s.scale.set(1.1, 1.2); s.alpha = 0; emissive.addChild(s); return s;
    }
    return null;
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
    if (grain) { grain.width = vw; grain.height = vh; }
    // foreground framing stays in screen space with a slight parallax against the camera
    const fgScale = Math.max(0.9, Math.min(1.6, vh / 720)) / scale;
    foreground.forEach((f, i) => {
      const sx = i === 0 ? -20 + (cam.x * 0.02) : vw + 20 - (cam.x * 0.02), sy = i === 0 ? vh + 20 : -10;
      f.position.set((sx - cam.x) / scale, (sy - cam.y) / scale); f.scale.set(fgScale);
    });
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
          if (walkLocalReq) { if (av.mode === 'ghost' || world.walkable(walkLocalReq.x, walkLocalReq.y)) av.walkTo(walkLocalReq.x, walkLocalReq.y); walkLocalReq = null; }
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

    // world + effects (cheap mode: no shimmer, no pools, fewer mist puffs)
    if (!low && !reducedMotion) world.update(t, dt);
    world.setNight(smooth(n));
    const fi = lerp(1, 0.6, smooth(n));                     // the fire stays the scene's anchor at night
    const flick = 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 19.7) * 0.02 + Math.sin(t * 2.1) * 0.02;
    fire.intensity = fi;
    fireLight.scale.set(3.4 * flick * (0.85 + 0.15 * fi)); fireLight.alpha = 0.95;
    fireLight2.scale.set(1.3 * flick); fireLight2.alpha = 0.9;
    firePool.alpha = (0.07 + 0.3 * moonL) * flick; firePool.scale.set(3.4 * flick, 2.1 * flick);
    moon.alpha = 0.4 * moonL; if (moonWaterRef) moonWaterRef.alpha = 0.10 * moonL;
    // tent lamps: a dim baseline at night, full when the tent is occupied (lanternLevel)
    tentLights.forEach((l, i) => {
      const lv = Math.max(moonL * 0.45, (lanternLevel[i] ?? 0) * moonL) * (0.9 + Math.sin(t * 5 + i) * 0.05);
      l.alpha = lv; const p = tentPools[i]; if (p) p.alpha = lv * 0.3; world.setTentLit(i, lv);
      const r = tentReflections[i]; if (r) r.alpha = lv * 0.14;
    });
    postLights.forEach((l, i) => { const lv = moonL * (0.8 + Math.sin(t * 4 + i * 2) * 0.06); l.alpha = lv; const b = postBulbs[i]; if (b) b.alpha = lv * 0.9; const r = postReflections[i]; if (r) r.alpha = lv * 0.18; });
    if (!low) { fireflies.level = moonL; fireflies.update(t); glints.night = moonL; glints.update(t); }
    mist.level = moonL; mist.update(t);
    fire.update(t, low ? 0 : dt, mixColor(0xd8d4cc, 0x5a6478, n));
    lighting.ambient = ambientColor(n);
    vignette.alpha = 0.65 + 0.2 * n;
    if (grain) grain.tilePosition.set((t * 37) % 64, (t * 53) % 64);
    ambience.night = n; ambience.fire = fi; ambience.update(dt);
  }

  function ambientColor(nl: number): number {
    // plates carry the time of day; the lightmap only shapes it: slight warm at dusk, a cool darkening at night
    const sm = smooth(nl);
    return mixColor(0xf6efe2, 0xa6adc0, sm);
  }

  const stat = (arr: number[]) => { const s = [...arr].sort((x, y) => x - y); const n = s.length || 1; return { avg: +(arr.reduce((x, y) => x + y, 0) / n).toFixed(2), p95: +(s[Math.floor(n * 0.95)] ?? 0).toFixed(2), max: +(s[n - 1] ?? 0).toFixed(2) }; };

  const handle: SceneHandle = {
    ready,
    quality,
    setInput(next) { if (!app) { input = next; snap = true; } else pendingInput = next; },
    setPoses(frame: PoseFrame) { poses.push(frame, performance.now()); },
    setSpeaking(seats) { speakingSet = new Set(seats); },
    on(event: 'move' | 'emote' | 'tap', cb: ((p: Pose) => void) | ((e: string) => void) | ((p: { x: number; y: number; seat: SeatId | null }) => void)) {
      const arr = listeners[event] as unknown[]; arr.push(cb);
      return () => { const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1); };
    },
    emote(e) { emoteReq = e; for (const cb of listeners.emote) cb(e); },
    setSpeakingLocal(on) { localSpeaking = on; },
    async setAudio(on) { if (on) await ambience.enable(); else ambience.disable(); },
    setCamera(mode) { cameraMode = mode; },
    setSafeArea(insets) { Object.assign(safe, insets); },
    resize() { app?.resize(); },
    time: () => t,
    perf: (): PerfStats | null => perfOn ? { n: perf.frames.length, frame: stat(perf.frames), update: stat(perf.update), lightmap: stat(perf.lightmap), render: stat(perf.render) } : null,
    perfReset() { perf.frames.length = perf.update.length = perf.lightmap.length = perf.render.length = 0; },
    walkLocal(x, y) { walkLocalReq = { x, y }; },
    localPose() { const me = avatars.get(input.me.seat); return me ? { seat: me.seat, x: me.x, y: me.y, facing: me.facing, moving: me.mode === 'walk' } : null; },
    night: () => nightLevel,
    destroy() {
      destroyed = true;
      ambience.disable();
      ro?.disconnect(); ro = null;
      if (onVis) { document.removeEventListener('visibilitychange', onVis); onVis = null; }
      if (app) { inputCtl?.detach(); for (const av of avatars.values()) av.destroy(); app.destroy(true, { children: true }); app = null; }
    },
  };
  void snap;
  return handle;
}
