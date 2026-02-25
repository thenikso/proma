import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    compatibility: {
      componentApi: 4,
    },
  },
  kit: {
    adapter: adapter({
      pages: 'public',
      assets: 'public',
      fallback: 'index.html',
    }),
    files: {
      appTemplate: 'src/app.html',
      assets: 'static',
      lib: 'src/lib',
      routes: 'src/routes',
    },
  },
};

export default config;
