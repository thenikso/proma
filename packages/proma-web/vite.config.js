import path from 'node:path';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

const PROD = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@proma/core': path.resolve('../proma-core/core/index.mjs'),
      '@proma/svelte-components': path.resolve('../proma-svelte-components/src/index.js'),
      stream: path.resolve('./node_modules/stream-browserify/index.js'),
    },
  },
  define: {
    IS_PRODUCTION: PROD ? 'true' : 'false',
    BACKEND_ENDPOINT: `'${process.env.BACKEND_ENDPOINT || 'http://localhost:3000/dev'}'`,
    AUTH0_DOMAIN: '"thenikso.eu.auth0.com"',
    AUTH0_CLIENTID: '"I0Vdf3zf7yoUnuvqKxYydiihHstUPd2G"',
    AUTH0_AUDIENCE: `"${process.env.SERVICE || 'dev-proma-web'}"`,
  },
});
