// Hosted-deploy switches read from env (ADR 0009). Pure, so tests cover them without starting a server.
// Unset = local behaviour unchanged (same-origin check only, LAN URLs when bound beyond loopback, port-range warning).
type Env = Record<string, string | undefined>;

const onRender = (env: Env) => env.RENDER === 'true';

// Extra origins allowed to open /ws besides same-origin (Origin host == Host). MOONVEIL_ALLOWED_ORIGINS is a
// comma-separated list of origins; on Render, RENDER_EXTERNAL_URL is added so a proxy-rewritten Host can't lock
// players out. Normalised to URL.origin; invalid entries are a startup error.
export function allowedOrigins(env: Env): string[] {
  const list = (env.MOONVEIL_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (onRender(env) && env.RENDER_EXTERNAL_URL) list.push(env.RENDER_EXTERNAL_URL);
  return [
    ...new Set(
      list.map((o) => {
        const u = new URL(o);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`allowed origin must be http(s): ${o}`);
        return u.origin;
      }),
    ),
  ];
}

// /api/lan lists this machine's LAN addresses for phone invites. Off on a hosted service (they'd be the provider's
// internal IPs) and when MOONVEIL_LAN=0.
export const lanEnabled = (env: Env): boolean => env.MOONVEIL_LAN !== '0' && !onRender(env);

// The 4100-4199 rule is for this workstation; Render injects its own PORT.
export const warnPort = (env: Env, port: number): boolean => !onRender(env) && (port < 4100 || port > 4199);
