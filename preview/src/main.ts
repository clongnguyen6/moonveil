import { Application, Container, Sprite } from 'pixi.js';
import { TextureBank } from './textures';
import { World, CORE, FIRE, WORLD } from './world';
import { Avatar, PRESETS, randomAppearance } from './avatar';
import { Lighting } from './lighting';
import { Fire, Fireflies, WaterGlints, Fog } from './particles';
import { Director, Scene, View } from './director';
import { Input } from './input';
import { Ambience } from './audio';
import { Hud } from './ui';
import { Rng, lerp, clamp, mixColor } from './rng';

const q = new URLSearchParams(location.search);
const playerCount = clamp(parseInt(q.get('n') ?? '10', 10) || 10, 4, 16);

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: window, background: '#0f1813', antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
    preference: 'webgl', powerPreference: 'high-performance',
  });
  const host = document.getElementById('app')!;
  host.appendChild(app.canvas);

  const bank = new TextureBank(app.renderer);
  const world = new World(bank, playerCount);
  const emissive = new Container();   // drawn after the lightmap: flames, sparks, fireflies, glints, ghost auras
  const fx = new Container();         // smoke, fog
  const lighting = new Lighting(app.renderer, bank.light);
  const vignette = new Sprite(bank.vignette); vignette.alpha = 0.9;
  app.stage.addChild(world.root, lighting.out, emissive, fx, vignette);

  // avatars
  const rng = new Rng(42);
  const avatars: Avatar[] = [];
  for (let i = 0; i < playerCount; i++) {
    const a = new Avatar(i < PRESETS.length ? PRESETS[i] : randomAppearance(rng, i), bank, i);
    world.objects.addChild(a.root); emissive.addChild(a.glow, ...a.wisps); avatars.push(a);
  }

  // lights
  const fireLight = lighting.addLight(0xffa84a, 3.2);
  const fireLight2 = lighting.addLight(0xff7a30, 1.4);
  fireLight.position.set(FIRE.x, FIRE.y - 10); fireLight2.position.set(FIRE.x, FIRE.y - 10);
  const moon = lighting.addLight(0x8690ff, 9, 0); moon.position.set(FIRE.x + 150, FIRE.y - 120);
  const moonEdge = lighting.addLight(0x6060c8, 16, 0); moonEdge.position.set(FIRE.x, FIRE.y);
  const tentLights = world.tents.map((t) => { const l = lighting.addLight(0xffa858, 1.0, 0); l.position.set(t.lanternAt.x, t.lanternAt.y + 20); return l; });
  const tentBulbs = world.tents.map((t) => { const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xffd890; s.position.set(t.x + 4, t.y - 34); s.scale.set(0.5); s.alpha = 0; emissive.addChild(s); return s; });
  const postLights = world.lanterns.map((p) => { const l = lighting.addLight(0xffb066, 1.4, 0); l.position.set(p.x, p.y + 10); return l; });
  const postBulbs = world.lanterns.map((p) => { const s = new Sprite(bank.dot); s.anchor.set(0.5); s.blendMode = 'add'; s.tint = 0xffe0a0; s.position.set(p.x, p.y); s.scale.set(0.6); s.alpha = 0; emissive.addChild(s); return s; });

  const fire = new Fire(emissive, fx, bank);
  const fireflies = new Fireflies(emissive, bank);
  const glints = new WaterGlints(emissive, bank);
  const fog = new Fog(fx, bank);

  const director = new Director(avatars, world);
  const input = new Input(host, document.body);
  const ambience = new Ambience();
  const portraitPhone = window.innerHeight > window.innerWidth * 1.1 && window.innerWidth < 600;
  let cameraMode: 'fit' | 'tight' = (q.get('cam') as 'fit' | 'tight') || (portraitPhone ? 'tight' : 'fit');

  const hud = new Hud(document.body, {
    setScene: (s) => director.setScene(s),
    setView: (v) => { director.view = v; },
    setSpeak: (on) => { director.localSpeaking = on; },
    setAutoSpeak: (on) => { director.autoSpeak = on; },
    setAudio: async (on) => { if (on) await ambience.enable(); else ambience.disable(); },
    emote: () => avatars[director.localIndex].showEmote('👋'),
    setCamera: (m) => { cameraMode = m; },
  }, { panel: q.get('panel') !== '0', touch: input.touch });
  director.onBanner = (b) => hud.banner(b);
  input.onSpeakKey = (down) => { director.localSpeaking = down || hud.mic; };
  hud.markCam(cameraMode);

  if (q.get('audio') !== '0') {
    const start = async () => { if (!ambience.enabled) { await ambience.enable(); hud.markAudio(true); } };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    if (!q.has('scene')) hud.toast('Tap or press a key to start the ambience', 4000);
  }
  if (q.get('speak') === '0') { director.autoSpeak = false; }

  // camera: fixed. 'fit' frames CORE on every screen; 'tight' (phones) zooms in and softly follows the local avatar.
  const cam = { x: 0, y: 0, scale: 1 };
  const follow = { x: CORE.x + CORE.w / 2, y: CORE.y + CORE.h / 2 };
  function layoutCamera(dt: number) {
    const vw = app.screen.width, vh = app.screen.height;
    const fit = Math.min(vw / CORE.w, vh / CORE.h);
    const portrait = vh > vw * 1.1;
    let scale = fit;
    let cx = CORE.x + CORE.w / 2, cy = CORE.y + CORE.h / 2;
    if (cameraMode === 'tight' && portrait) {
      scale = Math.max(fit, vh / 1150);
      const me = avatars[director.localIndex];
      // follow the local avatar while visible; ease back to the camp centre when they are inside their tent
      const tx = me.mode === 'hidden' ? CORE.x + CORE.w / 2 : me.x, ty = me.mode === 'hidden' ? FIRE.y - 60 : me.y - 40;
      follow.x = lerp(follow.x, tx, clamp(dt * 1.5, 0, 1)); follow.y = lerp(follow.y, ty, clamp(dt * 1.5, 0, 1));
      const halfW = vw / scale / 2, halfH = vh / scale / 2;
      cx = clamp(follow.x, CORE.x + halfW - 120, CORE.x + CORE.w - halfW + 120);
      cy = clamp(follow.y, CORE.y - 120 + halfH, WORLD.h + 40 - halfH);
    }
    cam.scale = scale; cam.x = vw / 2 - cx * scale; cam.y = vh / 2 - cy * scale;
    for (const c of [world.root, emissive, fx]) { c.position.set(cam.x, cam.y); c.scale.set(scale); }
    director.labelScale = clamp(1 / scale, 1, 3.2) * (scale < 0.65 ? 0.8 : 1);
    vignette.width = vw; vignette.height = vh;
  }
  let lastW = 0, lastH = 0;

  let t = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    t += dt;
    const vw = app.screen.width, vh = app.screen.height;
    if (vw !== lastW || vh !== lastH) { lighting.resize(vw, vh); lastW = vw; lastH = vh; }
    input.update();
    layoutCamera(dt);
    director.update(dt, input.dir);
    world.update(t, dt);

    const n = director.night, moonL = director.moonLevel;
    lighting.ambient = director.ambientColor;
    const fi = director.fireIntensity;
    fire.intensity = fi;
    const flick = 1 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 23.7) * 0.03 + Math.sin(t * 3.1) * 0.03;
    fireLight.scale.set(3.4 * flick * (0.7 + 0.3 * fi)); fireLight.alpha = 0.85 * (0.5 + 0.5 * fi);
    fireLight2.scale.set(1.5 * flick); fireLight2.alpha = 0.9;
    moon.alpha = 0.7 * moonL; moonEdge.alpha = 0.45 * moonL;
    world.tents.forEach((_, i) => { const l = director.lanternLevel[i] * (0.8 + Math.sin(t * 6 + i) * 0.08); tentLights[i].alpha = l * 0.9; tentBulbs[i].alpha = l * 0.9; tentBulbs[i].scale.set(0.45 + l * 0.2); });
    postLights.forEach((l, i) => { l.alpha = moonL * (0.75 + Math.sin(t * 5 + i * 2) * 0.1); postBulbs[i].alpha = moonL * 0.95; });
    fireflies.level = moonL; fireflies.update(t);
    glints.night = moonL; glints.update(t);
    fog.level = moonL * 0.45; fog.update(t);
    fire.update(t, dt, mixColor(0xffffff, 0x5a6090, n));
    ambience.night = n; ambience.fire = fi; ambience.update(dt);
    vignette.alpha = 0.75 + 0.25 * n;

    lighting.render(cam);
    hud.setPhase(director.phaseLabel, director.scene === 'lobby' ? `· ${playerCount} campers` : director.view === 'ghost' ? '· ghost view' : `· ${playerCount - director.ghosts.size} alive`, n > 0.5);
  });

  const initial = (q.get('scene') as Scene) || 'lobby';
  director.setScene(initial); hud.markScene(initial);
  if (q.get('view') === 'ghost') { director.view = 'ghost'; hud.markView('ghost'); }

  // automation hooks for captures
  (window as any).__moonveil = {
    setScene: (s: Scene) => { director.setScene(s); hud.markScene(s); },
    setView: (v: View) => { director.view = v; hud.markView(v); },
    setSpeak: (on: boolean) => { director.localSpeaking = on; hud.setMic(on); },
    setCamera: (m: 'fit' | 'tight') => { cameraMode = m; hud.markCam(m); },
    walk: (x: number, y: number) => avatars[director.localIndex].walkTo(x, y),
    emote: (s: string) => avatars[director.localIndex].showEmote(s),
    night: () => director.night,
    renderer: app.renderer.name,
    time: () => t,
    fps: () => app.ticker.FPS,
    debug: () => ({ fps: Math.round(app.ticker.FPS), t: Math.round(t * 10) / 10, scene: director.scene, night: director.night, timers: director.timerCount, av: avatars.slice(0, 3).map((a) => [Math.round(a.x), Math.round(a.y), a.mode, a.target ? 1 : 0]) }),
    ready: true,
  };
  console.log(`moonveil preview: ${app.renderer.name}, ${playerCount} players`);
}

boot();
