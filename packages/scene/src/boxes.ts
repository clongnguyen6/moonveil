// Screen-space boxes in world units (PURE): a seated camper occupies its stump + speaking ring up to the top of tall
// headgear. Shared by decorations (themes) and memorials so nothing is drawn over a seated camper.
import type { Pt } from './map.ts';

export interface Box { x0: number; y0: number; x1: number; y1: number }
export const seatBox = (s: Pt): Box => ({ x0: s.x - 30, y0: s.y - 108, x1: s.x + 30, y1: s.y + 18 });
export const BOX_MARGIN = 8;
export const boxesHit = (a: Box, b: Box, m = BOX_MARGIN): boolean => a.x0 - m < b.x1 && b.x0 - m < a.x1 && a.y0 - m < b.y1 && b.y0 - m < a.y1;
