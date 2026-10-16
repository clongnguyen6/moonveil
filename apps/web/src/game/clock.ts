// Server clock: the client learns `now` from state/hb frames; deadlines (phaseEndsAt) are server time.
let offsetMs = 0;
export const setServerOffset = (ms: number) => { offsetMs = ms; };
export const serverNow = () => Date.now() + offsetMs;
