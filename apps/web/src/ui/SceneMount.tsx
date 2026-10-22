// Mounts packages/scene into the .scene-slot per docs/visual/MOUNT.md. The scene gets only public fields
// (toSceneInput copies them); poses/speaking come from the session as the server filtered them.
import { type SceneHandle, fromWirePoses, mountScene, toSceneInput } from '@moonveil/scene';
import { useEffect, useRef } from 'react';
import { useSettings } from '../game/local-store.ts';
import { useLookDraft } from '../game/look-draft.ts';
import { sceneAppearance } from '@moonveil/scene';
import { projection } from '../game/select.ts';
import type { SessionState } from '../game/session.ts';
import { useSession } from './session-context.ts';

export function SceneMount({ s, topbarRef, micOn }: { s: SessionState; topbarRef: React.RefObject<HTMLDivElement | null>; micOn: boolean }) {
  const session = useSession();
  const slot = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const settings = useSettings();
  const view = s.view;
  const g = projection(view);
  const look = useLookDraft();

  useEffect(() => {
    if (!slot.current || !view) return;
    // debug read hooks (debugAppearance) only when the check environment asks for them; never in production
    const debug = (globalThis as { __MOONVEIL_SCENE_DEBUG?: boolean }).__MOONVEIL_SCENE_DEBUG === true;
    // DEV-ONLY Halloween preview: the stub dev page sets data-theme for ?theme=halloween (ui/dev/main.tsx); production never
    // does, the DEV guard drops this branch from the build, and the scene itself honours `theme` only in a dev build.
    const theme = import.meta.env.DEV && document.documentElement.dataset.theme === 'halloween' ? { theme: 'halloween' as const } : {};
    const h = mountScene(slot.current, { input: toSceneInput(view, g), ...(debug ? { debug: true } : {}), ...theme });
    scene.current = h;
    (globalThis as { __moonveilScene?: SceneHandle }).__moonveilScene = h; // test hook (debugAppearance / localPose)
    const off = h.on('move', (pose) => session.send({ t: 'move', x: Math.round(pose.x), y: Math.round(pose.y), facing: pose.facing, moving: pose.moving }));
    const offPoses = session.onPoses?.((poses) => h.setPoses(fromWirePoses(poses, 'world')));
    return () => {
      off();
      offPoses?.();
      h.destroy();
      scene.current = null;
      delete (globalThis as { __moonveilScene?: SceneHandle }).__moonveilScene;
    };
    // mount once per room; inputs flow through setInput below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.code]);

  useEffect(() => {
    if (view) scene.current?.setInput(toSceneInput(view, g));
  }, [view, g]);
  useEffect(() => {
    scene.current?.setSpeaking(s.speaking);
  }, [s.speaking]);
  // Local-only preview of the draft look on the local avatar (MOUNT.md: setLocalAppearanceOverride; null restores the snapshot look).
  useEffect(() => {
    if (!scene.current || !view) return;
    scene.current.setLocalAppearanceOverride(look.draft ? sceneAppearance(look.draft.appearance, view.me.seat) : null);
  }, [look.draft, view]);
  useEffect(() => {
    scene.current?.setSpeakingLocal(micOn);
  }, [micOn]);
  useEffect(() => {
    void scene.current?.setAudio(settings.ambience);
  }, [settings.ambience]);
  useEffect(() => {
    const top = topbarRef.current?.offsetHeight ?? 0;
    scene.current?.setSafeArea({ top });
  });
  // Chat overlay (sibling in .scene-host) vs the campfire circle. The camera frames the whole camp (frameRect); the
  // frame keeps 25.7 % of its height below the seat ring (CORE bottom 1060 vs lowest seated feet ≈ 849). So:
  // - compact box (phones, full width): reserve it as the bottom safe area only when it covers more than 25 % of the
  //   uncovered height (keyboard open, very short screens); otherwise it sits in that margin and the camp keeps its size;
  // - corner box (laptops): reserve it when it spans ≥ 40 % of the width or ≥ 30 % of the height (small laptops).
  // chat-check.mjs measures the seats against the box at phone and laptop sizes.
  useEffect(() => {
    const el = slot.current, host = el?.parentElement;
    const box = host?.querySelector<HTMLElement>('[data-testid=chat-overlay]');
    if (!el || !box) return;
    const apply = () => {
      const s = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      const cover = Math.max(0, Math.round(s.bottom - b.top)), inner = s.height - (topbarRef.current?.offsetHeight ?? 0);
      const reserve = box.dataset.compact === 'true' ? cover > 0.25 * inner : b.width >= 0.4 * s.width || b.height >= 0.3 * s.height;
      const bottom = reserve ? cover + 8 : 0;
      el.dataset.safeBottom = String(bottom);
      scene.current?.setSafeArea({ bottom });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el); ro.observe(box);
    const mo = new MutationObserver(apply);
    mo.observe(box, { attributes: true, attributeFilter: ['data-compact', 'class'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [view?.code, view?.status]);

  return <div className="scene-slot" ref={slot} data-testid="scene-slot" aria-hidden="true" />;
}
