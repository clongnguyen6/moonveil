// Helpers for specs that run the FIXTURE engine (server stub). Not real rules.
import { expect, type Player } from '../harness/index.ts';

export type FixtureGame = {
  phase: string;
  me?: { secret: string; inGroup: boolean };
  group?: { key: string; members: string[] };
  reveal?: { seat: string; secret: string }[];
};
export const fixtureGame = (p: Player) => p.view().game as FixtureGame;

// Wire-level check: no frame (up to index `upto` per player) carries another seat's secret,
// and non-members never get the group key, a group object, or a membership flag.
export function assertNoLeaks(players: Player[], groupKey: string, group: string[], upto?: Map<Player, number>) {
  const secrets = new Map(players.map((p) => [p.seat, fixtureGame(p).me!.secret]));
  for (const p of players) {
    const end = upto?.get(p);
    const wire = p.frames.slice(0, end === undefined || end < 0 ? undefined : end).map((f) => f.raw).join('\n');
    for (const [seat, s] of secrets) if (seat !== p.seat) expect(wire.includes(s), `${p.name} saw ${seat}'s secret`).toBe(false);
    if (!group.includes(p.seat)) {
      expect(wire.includes(groupKey), `${p.name} saw group key`).toBe(false);
      expect(wire.includes('"group"'), `${p.name} got a group object`).toBe(false);
      expect(wire.includes('"inGroup":true'), `${p.name} saw membership`).toBe(false);
    }
  }
}

// Index of the first frame showing the ended state (reveal is legitimate from there on).
export const endedAt = (p: Player) => p.frames.findIndex((f) => f.msg.t === 'state' && f.msg.view.status === 'ended');
