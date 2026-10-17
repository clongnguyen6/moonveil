// Hosted-deploy switches read from env, host-neutral (ADR 0010). Pure, so tests cover them without a server.
// Platform glue (Railway reference variables, Render dashboard values) lives in deploy/, not here.
// Unset = local behaviour unchanged (same-origin check only, LAN URLs when bound beyond loopback, port-range warning).
type Env = Record<string, string | undefined>;

const origin = (o: string): string => {
  const u = new URL(o);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`origin must be http(s): ${o}`);
  return u.origin;
};

// MOONVEIL_PUBLIC_ORIGIN: the public URL players open (e.g. https://<service>.up.railway.app). Set = hosted deploy.
export function publicOrigin(env: Env): string | undefined {
  const v = env.MOONVEIL_PUBLIC_ORIGIN?.trim();
  return v ? origin(v) : undefined;
}

// Extra origins allowed to open /ws besides same-origin (Origin host == Host): the public origin, so a proxy that
// rewrites Host can't lock players out, plus MOONVEIL_ALLOWED_ORIGINS (comma-separated). Normalised to URL.origin;
// invalid entries are a startup error.
export function allowedOrigins(env: Env): string[] {
  const list = (env.MOONVEIL_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(origin);
  const pub = publicOrigin(env);
  return [...new Set(pub ? [pub, ...list] : list)];
}

// /api/lan lists this machine's LAN addresses for phone invites. Off on a hosted deploy (they'd be the provider's
// internal IPs) and when MOONVEIL_LAN=0.
export const lanEnabled = (env: Env): boolean => env.MOONVEIL_LAN !== '0' && !publicOrigin(env);

// The 4100-4199 rule is for this workstation; hosts inject their own PORT.
export const warnPort = (env: Env, port: number): boolean => !publicOrigin(env) && (port < 4100 || port > 4199);

// --- /api/status (playtest diagnosis; no secrets) ---

// Deployed revision: MOONVEIL_REVISION (set at build/deploy), else Railway's RAILWAY_GIT_COMMIT_SHA (documented for
// GitHub-triggered deploys), else 'unknown'. Only a hex SHA is reported.
export function revision(env: Env): string {
  for (const v of [env.MOONVEIL_REVISION, env.RAILWAY_GIT_COMMIT_SHA]) {
    const s = v?.trim();
    if (s && /^[0-9a-f]{7,40}$/i.test(s)) return s.toLowerCase();
  }
  return 'unknown';
}

// Where rooms are saved: 'volume' (inside RAILWAY_VOLUME_MOUNT_PATH; path reported), 'temp' (on Railway but not on
// its volume: lost on redeploy), 'disk' (a local path elsewhere; durability depends on the host), or 'off'.
export type PersistInfo = { mode: 'volume'; path: string } | { mode: 'temp' | 'disk' | 'off' };
export function persistInfo(env: Env, dataDir: string, enabled: boolean): PersistInfo {
  if (!enabled) return { mode: 'off' };
  const mount = env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/+$/, '');
  if (mount && (dataDir === mount || dataDir.startsWith(`${mount}/`))) return { mode: 'volume', path: dataDir };
  const onRailway = Boolean(env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_SERVICE_ID || env.RAILWAY_PROJECT_ID);
  return { mode: onRailway ? 'temp' : 'disk' };
}

