export default function install({
  registry,
  chip,
  inputFlow,
  inputData,
  outputFlow,
  outputData,
  switchChip,
}) {
  const If = chip('lib/flowControl/If', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        if (condition()) {
          whenTrue();
        } else {
          whenFalse();
        }
      },
      executeCompiler: (portInstance, outterScope, codeWrapper, tools) => {
        const cont = tools.compile(whenTrue, outterScope, codeWrapper, tools);
        const alt =
          tools.compile(whenFalse, outterScope, codeWrapper, tools) || null;
        return tools.recast.types.builders.ifStatement(
          tools.compile(condition, outterScope, codeWrapper, tools),
          tools.recast.types.builders.blockStatement([
            tools.recast.types.builders.expressionStatement(cont),
          ]),
          alt &&
            tools.recast.types.builders.blockStatement([
              tools.recast.types.builders.expressionStatement(alt),
            ]),
        );
      },
    });
    const condition = inputData('condition', {
      canonical: true,
      defaultValue: false,
      type: 'boolean',
    });

    const whenTrue = outputFlow('whenTrue');
    const whenFalse = outputFlow('whenFalse');
  });

  const Sequence = chip('lib/flowControl/Sequence', () => {
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
  });

  const ForLoop = chip('lib/flowControl/ForLoop', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        for (let i = firstIndex(), l = lastIndex(); i < l; i++) {
          index(i);
          loopBody();
        }
        completed();
      },
    });
    const firstIndex = inputData('firstIndex', {
      canonical: true,
      defaultValue: 0,
      type: 'number',
    });
    const lastIndex = inputData('lastIndex', {
      canonical: true,
      type: 'number',
    });

    const loopBody = outputFlow('loopBody');
    const index = outputData('index', { type: 'number' });
    const completed = outputFlow('completed');
  });

  const WhileLoop = chip('lib/flowControl/WhileLoop', () => {
    const exec = inputFlow('exec', {
      execute: () => {
        while (condition()) {
          loopBody();
        }
        completed();
      },
    });
    const condition = inputData('condition', {
      canonical: true,
      defaultValue: false,
      type: 'boolean',
    });

    const loopBody = outputFlow('loopBody');
    const completed = outputFlow('completed');
  });

  const Switch = switchChip('lib/flowControl/Switch');

  return {
    If: registry.add(If),
    Sequence: registry.add(Sequence),
    ForLoop: registry.add(ForLoop),
    WhileLoop: registry.add(WhileLoop),
    Switch: registry.add(Switch),
  };
}
