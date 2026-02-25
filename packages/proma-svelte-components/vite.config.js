import path from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        compatibility: {
          componentApi: 4,
        },
      },
    }),
  ],
  build: {
    lib: {
      entry: path.resolve('src/index.js'),
      name: 'PromaSvelteComponents',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.js'),
    },
    rollupOptions: {
      external: ['svelte', 'codemirror', 'fast-deep-equal'],
      output: {
        globals: {
          svelte: 'svelte',
          codemirror: 'CodeMirror',
          'fast-deep-equal': 'fastDeepEqual',
        },
      },
    },
  },
});
