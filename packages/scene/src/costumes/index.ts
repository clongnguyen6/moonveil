// Costume registry (art-themes owner adds modules here). Ids are the scene-side costume ids.
import type { Costume } from '../rig.ts';
import { placeholder } from './placeholder.ts';
import { duck } from './duck.ts';
import { frog } from './frog.ts';
import { mushroom } from './mushroom.ts';
import { fish } from './fish.ts';
import { bowCat } from './bow-cat.ts';

export const COSTUMES: Record<string, Costume> = {
  [placeholder.id]: placeholder,
  [duck.id]: duck,
  [frog.id]: frog,
  [mushroom.id]: mushroom,
  [fish.id]: fish,
  [bowCat.id]: bowCat,
};
export function costumeById(id: string | undefined | null): Costume | null {
  return id ? COSTUMES[id] ?? null : null;
}
