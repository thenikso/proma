const envFilter = /^env(?:\/([A-Z]+))?$/;

module.exports = function envPlugin(defaults) {
  return {
    name: 'env',
    setup(build) {
      build.onResolve({ filter: envFilter }, (args) => ({
        path: args.path,
        namespace: 'env-variable',
      }));

      build.onLoad({ filter: /.*/, namespace: 'env-variable' }, (args) => {
        const evnVarName = (envFilter.exec(args.path) || [])[1];
        const env = Object.assign({}, defaults, process.env);
        const toExport = evnVarName ? env[evnVarName] : env;
        return { contents: `export default ${JSON.stringify(toExport)}` };
      });
    },
  };
};
