#!/usr/bin/env node
// Samples RSS/CPU of this checkout's processes every 500 ms until killed; prints peaks/averages on SIGTERM.
// Groups: browser (Playwright browsers in .cache/ms-playwright), server (apps/server/src/main.ts), runner (playwright test).
// Usage: node scripts/sample-resources.mjs > .cache/resources.json &
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const groups = {
  browser: (c) => c.includes(`${root}/.cache/ms-playwright`),
  server: (c) => c.includes('apps/server/src/main.ts'),
  runner: (c) => c.includes(`${root}/node_modules`) && c.includes('playwright') && !c.includes('ms-playwright'),
};
const stats = Object.fromEntries(Object.keys(groups).map((g) => [g, { peakRssMB: 0, peakCpu: 0, peakProcs: 0, cpuSum: 0, n: 0 }]));
const timer = setInterval(() => {
  const out = execFileSync('ps', ['-axo', 'rss=,%cpu=,command='], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const acc = Object.fromEntries(Object.keys(groups).map((g) => [g, { rss: 0, cpu: 0, procs: 0 }]));
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+([\d.]+)\s+(.*)$/.exec(line);
    if (!m) continue;
    for (const [g, test] of Object.entries(groups)) {
      if (test(m[3])) {
        acc[g].rss += Number(m[1]) / 1024;
        acc[g].cpu += Number(m[2]);
        acc[g].procs++;
        break;
      }
    }
  }
  for (const [g, a] of Object.entries(acc)) {
    const s = stats[g];
    s.peakRssMB = Math.max(s.peakRssMB, Math.round(a.rss));
    s.peakCpu = Math.max(s.peakCpu, Math.round(a.cpu));
    s.peakProcs = Math.max(s.peakProcs, a.procs);
    if (a.procs) {
      s.cpuSum += a.cpu;
      s.n++;
    }
  }
}, 500);
process.on('SIGTERM', () => {
  clearInterval(timer);
  for (const s of Object.values(stats)) {
    s.avgCpu = s.n ? Math.round(s.cpuSum / s.n) : 0;
    delete s.cpuSum;
    delete s.n;
  }
  console.log(JSON.stringify(stats));
  process.exit(0);
});
