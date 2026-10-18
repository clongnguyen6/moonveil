// Costume registry (art-themes owner). Production ids equal wire OutfitId; placeholder is dev-only.
import type { Costume } from '../rig.ts';
import { placeholder } from './placeholder.ts';
import { duck } from './duck.ts';
import { frog } from './frog.ts';
import { mushroom } from './mushroom.ts';
import { fish } from './fish.ts';
import { bowCat } from './bow-cat.ts';
import { robotCat } from './robot-cat.ts';

export const COSTUMES: Record<string, Costume> = {
  [placeholder.id]: placeholder,
  [duck.id]: duck,
  [frog.id]: frog,
  [mushroom.id]: mushroom,
  [fish.id]: fish,
  [bowCat.id]: bowCat,
  [robotCat.id]: robotCat,
};
export function costumeById(id: string | undefined | null): Costume | null {
  return id && Object.hasOwn(COSTUMES, id) ? COSTUMES[id] ?? null : null;
}
