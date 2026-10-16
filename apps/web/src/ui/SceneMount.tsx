// Mounts packages/scene into the .scene-slot per docs/visual/MOUNT.md. The scene gets only public fields
// (toSceneInput copies them); poses/speaking come from the session as the server filtered them.
import { type SceneHandle, fromWirePoses, mountScene, toSceneInput, toWireMove } from '@moonveil/scene';
import { useEffect, useRef } from 'react';
import { useSettings } from '../game/local-store.ts';
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

  useEffect(() => {
    if (!slot.current || !view) return;
    const h = mountScene(slot.current, { input: toSceneInput(view, g) });
    scene.current = h;
    const off = h.on('move', (pose) => session.send({ t: 'move', ...toWireMove(pose, 'normalized') }));
    return () => {
      off();
      h.destroy();
      scene.current = null;
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
  useEffect(() => {
    scene.current?.setPoses(fromWirePoses(s.poses, 'normalized'));
  }, [s.poses]);
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
