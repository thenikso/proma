const path = require('path');
const esbuild = require('esbuild');
const sveltePlugin = require('esbuild-svelte');
const { watch } = require('chokidar');
const envPlugin = require('./scripts/esbuild-env-plugin');

const WATCH = process.argv.includes('-w') || process.argv.includes('--watch');
const SERVE = process.argv.includes('-s') || process.argv.includes('--serve');

function build() {
  return esbuild.build({
    entryPoints: [path.resolve(__dirname, './src/main.js')],
    bundle: true,
    outfile: path.resolve(__dirname, './public/build/bundle.js'),
    plugins: [
      sveltePlugin(),
      envPlugin({
        BACKEND_ENDPOINT: 'http://localhost:3000/dev',
      }),
    ],
    logLevel: 'info',
  });
}

let server;

function serve() {
  if (server) return;
  server = require('child_process').spawn('npm', ['run', 'serve'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
  });

  process.on('SIGTERM', toExit);
  process.on('exit', toExit);

  function toExit() {
    if (server) server.kill(0);
  }
}

build().catch(() => process.exit(1));

if (WATCH) {
  console.log('Watching files...\n');
  const watcher = watch([path.resolve(__dirname, './src/**/*')]);
  watcher.on('change', () => {
    console.log('Rebuilding...\n');
    build().catch(() => {});
  });
}

if (SERVE) {
  serve();
}
