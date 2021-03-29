import { resolve } from 'path';

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
            path += '.js';
          }
          return {
            path,
          };
        });
      }
    },
  };
};
