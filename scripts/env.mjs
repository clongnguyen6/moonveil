#!/usr/bin/env node
// Runs a command with every tool cache/tmp dir inside this checkout (.cache/, gitignored).
// Rule: nothing writes outside the Moonveil repo. Use via root npm scripts: `node scripts/env.mjs <cmd> [args]`.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cache = join(root, '.cache');
const dirs = {
  npm_config_cache: join(cache, 'npm'),
  PLAYWRIGHT_BROWSERS_PATH: join(cache, 'ms-playwright'),
  TMPDIR: join(cache, 'tmp'),
  XDG_CACHE_HOME: join(cache, 'xdg-cache'),
  XDG_CONFIG_HOME: join(cache, 'xdg-config'),
  XDG_STATE_HOME: join(cache, 'xdg-state'),
  XDG_DATA_HOME: join(cache, 'xdg-data'),
};
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
const env = {
  ...process.env,
  ...dirs,
  TMP: dirs.TMPDIR,
  TEMP: dirs.TMPDIR,
  npm_config_update_notifier: 'false',
  npm_config_fund: 'false',
  npm_config_audit: 'false',
  MOONVEIL_ROOT: root,
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: node scripts/env.mjs <cmd> [args...]');
  process.exit(2);
}
const child = spawn(cmd, args, { stdio: 'inherit', env });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
