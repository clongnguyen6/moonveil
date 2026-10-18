// Mounts packages/scene into the .scene-slot per docs/visual/MOUNT.md. The scene gets only public fields
// (toSceneInput copies them); poses/speaking come from the session as the server filtered them.
import { type SceneHandle, fromWirePoses, mountScene, toSceneInput } from '@moonveil/scene';
import { useEffect, useRef } from 'react';
import { useSettings } from '../game/local-store.ts';
import { useLookDraft } from '../game/look-draft.ts';
import { appearanceFromProtocol } from '@moonveil/scene';
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
    const h = mountScene(slot.current, { input: toSceneInput(view, g), ...(debug ? { debug: true } : {}) });
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
    scene.current.setLocalAppearanceOverride(look.draft ? appearanceFromProtocol(look.draft.appearance, view.me.seat) : null);
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

  return <div className="scene-slot" ref={slot} data-testid="scene-slot" aria-hidden="true" />;
}
