// PURE: which cues to play for one batch of events, in order. Every cue of a batch used to collapse to the last one, so a
// Hunter dying at dawn ('death' then 'attention') lost the death cue. Now: unique cues in arrival order, at most two;
// a death cue is never dropped (it stays first when the batch is trimmed).
export type CueName = 'night' | 'dawn' | 'vote' | 'attention' | 'death' | 'victory' | 'defeat' | 'tap' | 'tick';
export const CUE_GAP_MS = 1100;   // between sequenced cues (the death cue is ~1.4 s; overlap is fine, masking is not)

export function orderCues(cues: readonly CueName[]): CueName[] {
  const uniq = cues.filter((c, i) => cues.indexOf(c) === i);
  if (uniq.length <= 2) return uniq;
  const last = uniq[uniq.length - 1]!;
  return uniq.includes('death') && last !== 'death' ? ['death', last] : [uniq[0]!, last];
}
