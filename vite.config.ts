// The game, served by Vite. The engine is cable-kit, a git submodule in
// ./cable-kit; its packages are dependencies (file:), read from their sources
// through the "source" condition of their exports, so that a change to the
// engine shows at once.
import { resolve } from 'node:path';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    conditions: ['source', ...defaultClientConditions],
    // the tubes import three from their own folder: one three.js for all
    dedupe: ['three'],
  },
  server: { fs: { allow: [resolve(__dirname)] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
