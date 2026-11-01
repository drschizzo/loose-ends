// The game, served by Vite. The engine is cable-kit, a git submodule in
// ./cable-kit; its packages are dependencies (file:), read from their sources
// through the "source" condition of their exports, so that a change to the
// engine shows at once. In dev, the level editor (editor.html) reads and
// writes the catalog of the course's parts through the plugin.
import { resolve } from 'node:path';
import { defaultClientConditions, defineConfig } from 'vite';
import { catalogFile } from './src/editor/plugin';

export default defineConfig({
  base: './',
  plugins: [catalogFile(__dirname)],
  resolve: {
    conditions: ['source', ...defaultClientConditions],
    // the tubes import three from their own folder: one three.js for all
    dedupe: ['three'],
  },
  server: { fs: { allow: [resolve(__dirname)] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
