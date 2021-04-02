import { resolve } from 'path';
import { existsSync } from 'fs';

export default function envPlugin(aliases) {
  return {
    name: 'alias',
    setup(build) {
      for (const [alias, result] of Object.entries(aliases)) {
        const filter = new RegExp(
          `^${alias.replaceAll(/(\$|\/|\(|\))/g, '\\$1')}(\/.*)?$`,
        );
        build.onResolve({ filter }, (args) => {
          const rest = (filter.exec(args.path) || [])[1];
          let path = `${result}${rest || ''}`;
          if (path.startsWith('./')) {
            path = resolve(process.cwd(), path);
          }
          if (!/\.[a-z]+$/i.test(path)) {
            if (existsSync(path + '.js')) {
              path += '.js';
            } else if (existsSync(path + '/index.js')) {
              path += '/index.js';
            }
          }
          return {
            path,
          };
        });
      }
    },
  };
}
