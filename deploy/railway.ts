// DRAFT Railway Infrastructure-as-Code (ADR 0010), primary host. Inactive here: Railway applies only
// `.railway/railway.ts` via `railway config plan` / `apply` (account action, needs approval), and this file needs the
// `railway` npm package (not installed; adding it is a dependency decision). Not typechecked by the repo.
// No secret values: preserve() keeps what was entered once in the Railway dashboard (sealed variables there).
// Never add test-only vars (MOONVEIL_TEST_*, MOONVEIL_ENGINE=fixture, MOONVEIL_FIXTURE_MS, E2E_*) or MOONVEIL_PERSIST.
// apps/server/test/deploy.test.ts checks this file. Dashboard-only settings: see 0010 (Serverless off, domain).
import { defineRailway, github, preserve, project, service, volume } from 'railway/iac';

const REGION = 'asia-southeast1-eqsg3a'; // Southeast Asia Metal (Singapore)
const rooms = volume('moonveil-rooms', { region: REGION, sizeMB: 500 }); // Trial/Free cap 0.5 GB; room files are KBs

const web = service('moonveil', {
  source: github('clongnguyen6/moonveil', { branch: 'main' }), // the deployed branch is part of deploy approval
  build: 'npm run build',
  start: 'node apps/server/src/main.ts',
  healthcheck: '/healthz',
  replicas: { [REGION]: 1 }, // one instance: rooms live in memory (0007); volumes forbid replicas anyway
  volumeMounts: { '/data': rooms },
  env: {
    RAILPACK_NODE_VERSION: '24.20.0', // the version all checks ran on; engines >=24.12 has no upper bound
    RAILPACK_NODE_NPM_INSTALL: 'npm ci --include=dev', // the web build needs devDependencies (Vite, TS)
    HOST: '0.0.0.0',
    MOONVEIL_ENGINE: 'rules',
    MOONVEIL_DATA_DIR: '/data/rooms', // restart recovery on the volume (approved behaviour)
    MOONVEIL_PUBLIC_ORIGIN: preserve(), // dashboard: https://${{RAILWAY_PUBLIC_DOMAIN}}
    LIVEKIT_URL: preserve(),
    LIVEKIT_PUBLIC_WS: preserve(),
    LIVEKIT_API_KEY: preserve(),
    LIVEKIT_API_SECRET: preserve(),
  },
});

export default defineRailway(() => project('moonveil', { resources: [rooms, web] }));
