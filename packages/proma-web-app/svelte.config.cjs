const serverless = require('@thenikso/adapter-serverless');
const pkg = require('./package.json');

/** @type {import('@sveltejs/kit').Config} */
module.exports = {
  kit: {
    adapter: serverless(),
    paths: {
      // assets: 'http://localhost:3000/dev',
      base: '/dev',
    },

    // hydrate the <div id="svelte"> element in src/app.html
    target: '#svelte',

    vite: {
      ssr: {
        noExternal: Object.keys(pkg.dependencies || {}),
      },
    },
  },
};
