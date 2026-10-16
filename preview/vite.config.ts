import { defineConfig } from 'vite';

// Preview only. Ports 4200-4299 are reserved for the visual scope.
export default defineConfig({
  server: { port: 4200, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4201, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022', sourcemap: false },
  cacheDir: '.cache/vite',
});
