// Deterministic match states for building and screenshotting each screen. Dev only.
import type { Mode, Profile } from '@moonveil/protocol';
import type { Role, Seat } from '@moonveil/rules';
import { LocalRoom } from './local-room.ts';

export const SCENARIOS = [
  'entry',
  'lobby',
  'role',
  'night-wolf',
  'night-seer',
  'night-guard',
  'night-villager',
  'witch',
  'hunter',
  'day',
  'vote',
  'defense',
  'confirm',
  'ghost',
  'ended',
  'moderator',
  'moderator-day',
] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

const NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khoa', 'Linh', 'Minh'];
const COLORS = ['ember', 'moss', 'river', 'dusk', 'sand', 'berry', 'pine', 'slate'] as const;
const HATS = ['none', 'beanie', 'cap', 'bucket', 'flower', 'hood', 'none', 'cap'] as const;

export const players = (count = 8): Profile[] =>
  NAMES.slice(0, count).map((name, i) => ({ name, appearance: { color: COLORS[i % 8]!, hat: HATS[i % 8]! } }));

export function makeRoom(mode: Mode, opts: { speed?: number; autoBots?: boolean; count?: number; voiceMode?: 'remote' | 'inPerson' } = {}) {
  return new LocalRoom({ mode, players: players(opts.count ?? 8), speed: opts.speed ?? 1, autoBots: opts.autoBots ?? false, voiceMode: opts.voiceMode ?? 'remote', seed: 'moonveil-ui-7' });
}

export function scenario(name: ScenarioName, opts: { speed?: number; autoBots?: boolean } = {}): LocalRoom {
  const mode: Mode = name.startsWith('moderator') ? 'moderator' : 'automatic';
  const room = makeRoom(mode, { speed: opts.speed ?? 0, autoBots: opts.autoBots ?? false });
  if (name === 'entry') {
    room.players = [];
    room.conn = 'idle';
    return room;
  }
  if (name === 'lobby') {
    room.players.forEach((p, i) => (p.ready = i % 3 !== 2));
    room.players[1]!.connected = false;
    room.chat.push({ channel: 'public', msg: { id: 'c1', from: room.players[2]!.id, text: 'Mọi người bật mic chưa?', at: Date.now() - 60_000 } });
    room.chat.push({ channel: 'public', msg: { id: 'c2', from: room.players[0]!.id, text: 'Ready when you are ✌️', at: Date.now() - 30_000 } });
    return room;
  }
  room.start();
  const g = () => room.game!;
  const roleSeat = (r: Role, nth = 0): Seat => g().match.seats.filter((s) => s.role === r)[nth]!.seat;
  const idOf = (i: Seat) => g().seatIds[i]!;
  const villagers = () => g().match.seats.filter((s) => s.role === 'villager').map((s) => s.seat);
  const wolves = () => g().match.seats.filter((s) => s.role === 'wolf').map((s) => s.seat);
  const alive = () => g().match.seats.filter((s) => s.alive).map((s) => s.seat);
  const view = (i: Seat) => room.setViewer(idOf(i));

  const night1 = (victim: Seat) => {
    for (const w of wolves()) room.drive({ type: 'wolf.pick', seat: w, target: victim });
    room.drive({ type: 'seer.inspect', seat: roleSeat('seer'), target: wolves()[0]! });
    room.drive({ type: 'guard.protect', seat: roleSeat('guard'), target: villagers()[1]! });
    room.drive({ type: 'step.close' });
  };
  const witchPass = () => {
    room.drive({ type: 'witch.heal', seat: roleSeat('witch'), use: false });
    room.drive({ type: 'witch.poison', seat: roleSeat('witch'), target: 'pass' });
    room.drive({ type: 'step.close' });
  };

  switch (name) {
    case 'role':
      view(roleSeat('seer'));
      return room;
    case 'night-wolf':
      room.drive({ type: 'wolf.pick', seat: wolves()[1]!, target: villagers()[0]! });
      view(wolves()[0]!);
      return room;
    case 'night-seer':
      view(roleSeat('seer'));
      return room;
    case 'night-guard':
      view(roleSeat('guard'));
      return room;
    case 'night-villager':
      view(villagers()[0]!);
      return room;
    case 'witch':
      for (const w of wolves()) room.drive({ type: 'wolf.pick', seat: w, target: villagers()[0]! });
      room.drive({ type: 'step.close' });
      view(roleSeat('witch'));
      return room;
    case 'hunter':
      night1(roleSeat('hunter'));
      witchPass();
      view(roleSeat('hunter'));
      return room;
    case 'moderator':
      room.drive({ type: 'wolf.pick', seat: wolves()[0]!, target: villagers()[0]! });
      room.setViewer(room.moderator!.id);
      return room;
  }
  // Day 1 after one night death (a villager).
  night1(villagers()[0]!);
  witchPass();
  const dead = g().match.seats.find((s) => !s.alive)!.seat;
  if (name === 'day' || name === 'moderator-day') {
    room.chat.push({ channel: 'public', msg: { id: 'c1', from: idOf(alive()[1]!), text: 'Đêm qua yên tĩnh quá… ai có thông tin không?', at: Date.now() - 20_000 } });
    room.setViewer(name === 'moderator-day' ? room.moderator!.id : idOf(alive()[0]!));
    room.setSpeaking([idOf(alive()[2]!)]);
    return room;
  }
  if (name === 'ghost') {
    room.chat.push({ channel: 'ghosts', msg: { id: 'c1', from: idOf(dead), text: '…', at: Date.now() - 5000 } });
    view(dead);
    return room;
  }
  room.drive({ type: 'step.close' }); // day.vote
  const suspect = wolves()[0]!;
  const voters = alive().filter((s) => s !== suspect);
  voters.slice(0, 3).forEach((s) => room.drive({ type: 'vote.nominate', seat: s, target: suspect }));
  room.drive({ type: 'vote.nominate', seat: voters[3]!, target: 'skip' });
  room.drive({ type: 'vote.nominate', seat: suspect, target: voters[0]! });
  if (name === 'vote') {
    view(voters[4]!);
    return room;
  }
  room.drive({ type: 'step.close' }); // day.defense
  if (name === 'defense') {
    view(voters[0]!);
    return room;
  }
  room.drive({ type: 'step.close' }); // day.confirm
  voters.slice(0, 2).forEach((s) => room.drive({ type: 'vote.confirm', seat: s, choice: 'yes' }));
  room.drive({ type: 'vote.confirm', seat: voters[2]!, choice: 'no' });
  if (name === 'confirm') {
    view(voters[3]!);
    return room;
  }
  // ended: the village executes both wolves across two days (Yes*2 > living, approved threshold).
  const confirmAll = (accused: Seat) => alive().filter((s) => s !== accused).forEach((s) => room.drive({ type: 'vote.confirm', seat: s, choice: 'yes' }));
  const day = (accused: Seat) => {
    room.drive({ type: 'step.close' }); // -> day.vote
    alive().filter((s) => s !== accused).forEach((s) => room.drive({ type: 'vote.nominate', seat: s, target: accused }));
    room.drive({ type: 'step.close' }); // -> defense
    room.drive({ type: 'step.close' }); // -> confirm
    confirmAll(accused);
    room.drive({ type: 'step.close' }); // -> execution
  };
  confirmAll(suspect);
  room.drive({ type: 'step.close' }); // wolf 1 executed -> night 2
  room.drive({ type: 'wolf.pick', seat: wolves()[1]!, target: 'pass' });
  room.drive({ type: 'step.close' });
  room.drive({ type: 'step.close' }); // dawn, nobody died -> day 2
  day(wolves()[1]!);
  view(voters[0]!);
  return room;
}
