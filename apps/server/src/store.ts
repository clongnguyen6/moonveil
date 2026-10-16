// Restart recovery: room snapshots on disk (one JSON file per room, atomic write via rename).
// Contains bearer tokens and secrets: the data dir is gitignored, files are 0600, deleted on room close.
// The host operator can read secrets anyway (ADR 0003 trust note); persistence adds little exposure.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RoomSnapshot {
  v: 1;
  engine: string;
  code: string;
  savedAt: number;
  [k: string]: unknown;
}

export interface RoomStore {
  save(s: RoomSnapshot): void;
  remove(code: string): void;
  loadAll(): RoomSnapshot[];
}

export function memoryRoomStore(): RoomStore & { rooms: Map<string, string> } {
  const rooms = new Map<string, string>();
  return {
    rooms,
    save: (s) => void rooms.set(s.code, JSON.stringify(s)),
    remove: (code) => void rooms.delete(code),
    loadAll: () => [...rooms.values()].map((j) => JSON.parse(j) as RoomSnapshot),
  };
}

const CODE = /^[A-HJKMNP-Z2-9]{6}$/;

export function fileRoomStore(dir: string): RoomStore {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (code: string) => join(dir, `${code}.json`);
  return {
    save(s) {
      if (!CODE.test(s.code)) throw new Error(`bad room code ${s.code}`);
      const tmp = `${file(s.code)}.tmp`;
      writeFileSync(tmp, JSON.stringify(s), { mode: 0o600 });
      renameSync(tmp, file(s.code));
    },
    remove(code) {
      if (CODE.test(code)) rmSync(file(code), { force: true });
    },
    loadAll() {
      const out: RoomSnapshot[] = [];
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.json')) continue;
        try {
          const s = JSON.parse(readFileSync(join(dir, name), 'utf8')) as RoomSnapshot;
          if (s.v === 1 && CODE.test(s.code)) out.push(s);
        } catch (e) {
          console.error(`skipping unreadable room file ${name}:`, (e as Error).message);
        }
      }
      return out;
    },
  };
}
