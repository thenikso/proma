export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
}) {
  return registry.add(
    chip('lib/flow/Sequence', () => {
      const exec = inputFlow('exec', {
        execute: () => {
          for (const t of then()) {
            t();
          }
        },
        executeCompiler: (
          portInstance,
          outterScope,
          codeWrapper,
          { compile, recast },
        ) => {
          const calls = [];
          for (const p of portInstance.chip.out.then.variadic) {
            if (p) {
              calls.push(compile(p, outterScope, codeWrapper));
            }
          }
          return recast.types.builders.blockStatement(
            calls.map((c) => recast.types.builders.expressionStatement(c)),
          );
        },
      });
      const then = outputFlow('then', { variadic: 'then{index}' });
    }),
  );
}
