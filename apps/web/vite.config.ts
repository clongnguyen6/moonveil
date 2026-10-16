import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: vite on 4101 proxies /ws to the server on 4100. Prod/e2e: server serves dist/ itself.
export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 4101),
    strictPort: true,
    proxy: {
      '/ws': { target: `ws://127.0.0.1:${process.env.PORT ?? 4100}`, ws: true },
      '/api': { target: `http://127.0.0.1:${process.env.PORT ?? 4100}` },
    },
  },
  build: { target: 'es2022' },
});
