import path from 'path';
import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import aliasPlugin from './scripts/esbuild-alias-plugin.mjs';
import childProcess from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const PROD = process.env.NODE_ENV === 'production';
const WATCH = process.argv.includes('-w') || process.argv.includes('--watch');
const SERVE = process.argv.includes('-s') || process.argv.includes('--serve');

function build() {
  return esbuild.build({
    entryPoints: [path.resolve(__dirname, './src/main.js')],
    bundle: true,
    outfile: path.resolve(__dirname, './public/build/bundle.js'),
    define: {
      BACKEND_ENDPOINT: `'${
        process.env.BACKEND_ENDPOINT || 'http://localhost:3000/dev'
      }'`,
    },
    plugins: [
      aliasPlugin({
        $lib: path.resolve(__dirname, './src/lib'),
        '@proma/core': path.resolve(
          __dirname,
          '../../proma-core/core/index.mjs',
        ),
        '@proma/svelte-components': path.resolve(
          __dirname,
          '../../proma-svelte-components/src/index.js',
        ),
      }),
      sveltePlugin(),
    ],
    logLevel: 'info',
    sourcemap: !PROD,
    watch: WATCH,
  });
}

let server;

function serve() {
  if (server) return;
  server = childProcess.spawn('npm', ['run', 'serve'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
  });

  process.on('SIGTERM', toExit);
  process.on('exit', toExit);

  function toExit() {
    if (server) server.kill(0);
  }
}

build()
  .then(() => {
    if (SERVE) {
      serve();
    }
  })
  .catch(() => {
    process.exit(1);
    return false;
  });
