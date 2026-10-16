#!/usr/bin/env node
// Machine conditions for evidence reports (cheap): load averages, CPUs, memory. Usage: node scripts/conditions.mjs <label>
import os from 'node:os';
const gb = (n) => Math.round((n / 2 ** 30) * 10) / 10;
console.log(
  `CONDITIONS ${JSON.stringify({
    label: process.argv[2] ?? '',
    at: new Date().toISOString(),
    loadavg: os.loadavg().map((x) => Math.round(x * 100) / 100),
    cpus: os.cpus().length,
    freeGB: gb(os.freemem()),
    totalGB: gb(os.totalmem()),
  })}`,
);
