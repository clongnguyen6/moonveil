import { defineConfig } from 'vite';
// Dev harness lives in dev/ (fixtures + preview panel). Ports 4200-4299 belong to the visual scope.
export default defineConfig({ root: 'dev', cacheDir: '../.cache/vite', build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' } });
