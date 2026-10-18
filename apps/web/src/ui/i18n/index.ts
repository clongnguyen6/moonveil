import type { Role } from '@moonveil/rules';
import { type Lang, useSettings } from '../../game/local-store.ts';
import { type Strings, en } from './en.ts';
import { vi } from './vi.ts';

const TABLES: Record<Lang, Strings> = { en, vi };
export type Key = Exclude<keyof Strings, 'stepDisplay' | 'lookNames'>;
export type T = ((key: Key, params?: Record<string, string | number>) => string) & { lang: Lang; role: (r: Role) => string; step: (k: string) => string; s: Strings };

export function makeT(lang: Lang): T {
  const s = TABLES[lang];
  const fn = ((key: Key, params?: Record<string, string | number>) => {
    let out = s[key] as string;
    if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v));
    return out;
  }) as T;
  fn.lang = lang;
  fn.s = s;
  fn.role = (r) => s[`role${r[0]!.toUpperCase()}${r.slice(1)}` as Key] as string;
  fn.step = (k) => s.stepDisplay[k] ?? k;
  return fn;
}

export function useT(): T {
  return makeT(useSettings().lang);
}
