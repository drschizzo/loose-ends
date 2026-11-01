// The game, served by Vite. The engine is read from the sources of cable-kit,
// next to this folder (../cable-kit), so that a change to it shows at once.
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const kit = resolve(__dirname, '../cable-kit/packages');

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@drschizzo/avbd-cables': resolve(kit, 'avbd-cables/src/index.ts'),
      '@drschizzo/three-cable-tubes': resolve(kit, 'three-cable-tubes/src/index.ts'),
    },
    // the tubes import three from their own folder: one three.js for all
    dedupe: ['three'],
  },
  server: { fs: { allow: [resolve(__dirname), kit] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
