// Costume registry (art-themes owner adds modules here). Ids are the scene-side costume ids.
import type { Costume } from '../rig.ts';
import { placeholder } from './placeholder.ts';

export const COSTUMES: Record<string, Costume> = {
  [placeholder.id]: placeholder,
};
export function costumeById(id: string | undefined | null): Costume | null {
  return id ? COSTUMES[id] ?? null : null;
}
