import esbuild from 'esbuild';
import fetch from 'node-fetch';

let httpPlugin = {
  name: 'http',
  setup(build) {
    // Intercept import paths starting with "http:" and "https:" so
    // esbuild doesn't attempt to map them to a file system location.
    // Tag them with the "http-url" namespace to associate them with
    // this plugin.
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: 'http-url',
    }));

    // We also want to intercept all import paths inside downloaded
    // files and resolve them against the original URL. All of these
    // files will be in the "http-url" namespace. Make sure to keep
    // the newly resolved URL in the "http-url" namespace so imports
    // inside it will also be resolved as URLs recursively.
    build.onResolve({ filter: /.*/, namespace: 'http-url' }, (args) => ({
      path: new URL(args.path, args.importer).toString(),
      namespace: 'http-url',
    }));

    // When a URL is loaded, we want to actually download the content
    // from the internet. This has just enough logic to be able to
    // handle the example import from unpkg.com but in reality this
    // would probably need to be more complex.
    build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
      const url = args.path;
      console.log(`Downloading: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`GET ${url} failed: status ${res.status}`);
      }
      const contents = await res.text();
      return { contents };
    });
  },
};

export async function buildCode(code) {
  const res = await esbuild.build({
    stdin: {
      contents: code,
      loader: 'js',
      resolveDir: __dirname,
    },
    format: 'iife',
    plugins: [httpPlugin],
    bundle: true,
    write: false,
  });
  return res.outputFiles[0].text;
}

// TODO may need to mask some global values
export async function getCodeRunResult(code) {
  const finalCode = await buildCode(code);
  const exec = new Function('$STORE_RES', finalCode);
  let res;
  let $STORE_RES = (v) => {
    res = v;
  };
  exec($STORE_RES);
  return res;
}

export function makeClassCode(classCode, imports) {
  const importsCode = Array.from(Object.entries(imports)).reduce(
    (acc, [name, url]) => acc + `import ${name} from '${url}';\n`,
    '',
  );
  return importsCode + `$STORE_RES(${classCode})`;
}

export function getCompiledClass(classCode, imports) {
  return getCodeRunResult(makeClassCode(classCode, imports));
}
