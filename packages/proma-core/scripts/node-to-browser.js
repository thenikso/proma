const esbuild = require('esbuild');

const nodeToBrowser = {
  name: 'nodeToBrowser',
  setup(build) {
    build.onResolve({ filter: /^os$/ }, (args) => ({
      path: args.path,
      namespace: 'node-to-browser',
    }));

    build.onLoad({ filter: /^os$/, namespace: 'node-to-browser' }, (args) => ({
      contents: `module.exports = {
        endianness() {
          return 'LE';
        },
        hostname() {
          if (typeof location !== 'undefined') {
            return location.hostname;
          } else return '';
        },
        loadavg() {
          return [];
        },
        uptime() {
          return 0;
        },
        freemem() {
          return Number.MAX_VALUE;
        },
        totalmem() {
          return Number.MAX_VALUE;
        },
        cpus() {
          return [];
        },
        type() {
          return 'Browser';
        },
        release() {
          if (typeof navigator !== 'undefined') {
            return navigator.appVersion;
          }
          return '';
        },
        networkInterfaces() {
          return {};
        },
        getNetworkInterfaces() {
          return {};
        },
        arch() {
          return 'javascript';
        },
        platform() {
          return 'browser';
        },
        tmpdir() {
          return '/tmp';
        },
        tmpDir() {
          return '/tmp';
        },
        EOL: '\\n',
        homedir() {
          return '/';
        },
      };`,
    }));
  },
};

esbuild
  .build({
    entryPoints: [process.argv[2]],
    format: 'esm',
    bundle: true,
    outfile: process.argv[3],
    plugins: [nodeToBrowser],
  })
  .catch(() => process.exit(1));
