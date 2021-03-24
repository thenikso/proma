import { context, assert, info } from './utils.mjs';
import { Chip as ChipBase, ChipInfo } from './chip.mjs';
import { runFlowPorts } from './run.mjs';
import { Compilation } from './compile.mjs';
import { ExternalReference } from './external.mjs';

// Creates a chip
export const plainChip = makeChipFactory();

const OnCreate = event('OnCreate');
const OnDestroy = event('OnDestroy');

// Creates a chip with OnCreate and OnDestroy provided custom chips
export const chip = makeChipFactory(
  () => {
    return { OnCreate, OnDestroy };
  },
  {
    onCreate: {
      selectPorts(chip) {
        if (chip instanceof OnCreate) {
          return [chip.out.then];
        }
      },
    },
    onDestroy: {
      selectPorts(chip) {
        if (chip instanceof OnDestroy) {
          return [chip.out.then];
        }
      },
    },
  },
);

export function inputFlow(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputFlowPort(name, config);
}

export function inputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, config);
}

export function outputFlow(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputFlowPort(name, config);
}

export function outputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputDataPort(name, config);
}

export function wire(portA, portB) {
  const chipInfo = context(ChipInfo);
  chipInfo.addConnection(portA, portB);
}

export function inputConfig(name, { defaultValue, required } = {}) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, {
    canonical: required ? 'required' : true,
    conceiled: true,
    defaultValue,
  });
}

export function outputHandle(name, execHandle, type) {
  assert(
    typeof execHandle === 'function',
    'A handler should specify a function',
  );
  const compute = () => execHandle;
  compute.toString = () => '() => ' + String(execHandle);
  const handlePort = outputData(name, {
    compute,
    inline: 'once',
    allowSideEffects: true,
    type,
  });
  Object.defineProperty(handlePort, 'isHandle', {
    enumerable: true,
    value: true,
  });
  return handlePort;
}

export function event(name, ...ports) {
  ports = (ports || []).map((p) => {
    if (typeof p === 'string') {
      const [name, type] = p.split(':');
      return { name, type: type || 'any' };
    }
    return p;
  });
  const handleArgs = ports
    .map(({ name, type }) => `${name}:${type || 'any'}`)
    .join(', ');
  const handleType = `(${handleArgs}) => void`;
  const EventChip = plainChip(name, () => {
    const handler = (...args) => {
      for (let i = 0, l = outputs.length; i < l; i++) {
        outputs[i](args[i]);
      }
      then();
    };
    handler.toString = () => `(...args) => {
      ${ports.map(({ name }, i) => `${name}(args[${i}]);`).join('\n')}
      then();
    }`;
    const handle = outputHandle('handle', handler, handleType);
    const then = outputFlow('then');
    const outputs = ports.map(({ name, type }) => outputData(name, { type }));
  });
  Object.defineProperties(EventChip.prototype, {
    customChipKind: {
      enumerable: true,
      value: 'event',
    },
    chipURI: {
      enumerable: true,
      value:
        ports.length === 0 ? `${name}:event` : `${name}:event(${handleArgs})`,
    },
  });
  return EventChip;
}

export function switchChip(name, type = 'any') {
  const SwitchChip = plainChip(name, () => {
    const exec = inputFlow('exec', {
      execute: () => {
        const allCases = cases();
        const allCasesCont = thens();
        const sel = discriminant();
        for (let i = 0, l = allCases.length; i < l; i++) {
          const caseValue = allCases[i];
          if (caseValue === sel) {
            allCasesCont[i]();
            return;
          }
        }
        thenDefault();
      },
      executeCompiler: (port, scope, codeWrapper, tools) => {
        const disc = tools.compile(discriminant, scope, codeWrapper, tools);
        if (!disc) return;
        const switchCases = [];
        const { port: casesPort } = tools.getPortAndChipInstance(cases, scope);
        const { port: thensPort } = tools.getPortAndChipInstance(thens, scope);
        for (let i = 0, l = casesPort.variadic.length; i < l; i++) {
          const casePort = casesPort.variadic[i];
          const thenPort = thensPort.variadic[i];
          const caseDiscr = tools.compile(casePort, scope, codeWrapper, tools);
          let caseBlock = tools.compile(thenPort, scope, codeWrapper, tools);
          if (!tools.recast.types.namedTypes.Statement.check(caseBlock)) {
            caseBlock = tools.recast.types.builders.expressionStatement(
              caseBlock,
            );
          }
          switchCases.push(
            tools.recast.types.builders.switchCase(caseDiscr, [
              caseBlock,
              tools.recast.types.builders.breakStatement(),
            ]),
          );
        }
        let defaultCaseBlock = tools.compile(
          thenDefault,
          scope,
          codeWrapper,
          tools,
        );
        if (!tools.recast.types.namedTypes.Statement.check(defaultCaseBlock)) {
          defaultCaseBlock = tools.recast.types.builders.expressionStatement(
            defaultCaseBlock,
          );
        }
        if (defaultCaseBlock) {
          switchCases.push(
            tools.recast.types.builders.switchCase(null, [
              defaultCaseBlock,
              tools.recast.types.builders.breakStatement(),
            ]),
          );
        }
        if (switchCases.length === 0) return;
        return tools.recast.types.builders.switchStatement(disc, switchCases);
      },
    });
    const discriminant = inputData('discriminant', { canonical: true, type });
    const cases = inputData('cases', {
      type: `[${type}]`,
      variadic: 'case{index}',
    });
    const thenDefault = outputFlow('thenDefault');
    const thens = outputFlow('thens', { variadic: 'then{index}' });
  });
  Object.defineProperties(SwitchChip.prototype, {
    customChipKind: {
      enumerable: true,
      value: 'switch',
    },
    chipURI: {
      enumerable: true,
      value: `${name}:switch(${type})`,
    },
  });
  return SwitchChip;
}

// NOTE externalReferenceObj must be specified as `{ myReference }` so that
// the engine can extract both a compiletime name and a runtime reference.
// If the name is not somehow provided to the compiled code (ie: by adding a
// value to `window.myReference`), the compiled code will fail to execute.
export function externalRef(externalReferenceObj) {
  return new ExternalReference(externalReferenceObj);
}

const ExternalGetInt = plainChip('ExternalGet', () => {
  const externalDataRef = inputData('externalDataRef', {
    canonical: 'required',
    conceiled: 'hidden',
  });
  outputData('value', () => externalDataRef());
});

export function externalGet(externalReferenceObj) {
  return class ExternalGet extends ExternalGetInt {
    constructor() {
      super(externalRef(externalReferenceObj));
    }
  };
}

const ExternalSetInt = plainChip('ExternalSet', () => {
  const exec = inputFlow('exec', () => {
    externalSetRef()(value());
    then();
  });
  const externalSetRef = inputData('externalSetRef', {
    canonical: 'required',
    conceiled: 'hidden',
  });
  const value = inputData('value', {
    canonical: true,
  });
  const then = outputFlow('then');
  const outValue = outputData('value');
  wire(value, outValue);
});

export function externalSet(externalReferenceObj) {
  return class ExternalSet extends ExternalSetInt {
    constructor(...args) {
      super(externalRef(externalReferenceObj), ...args);
    }
  };
}

//
// Implementations
//

function makeChipFactory($customChips, $hooks) {
  function chip(uri, build, configuration) {
    if (typeof uri !== 'string') {
      build = uri;
      uri = undefined;
    }
    const config = Object.assign(
      {
        editable: true,
        metadata: undefined,
      },
      configuration,
    );
    const chipInfo = new ChipInfo(uri, config.label);
    context.push(chipInfo);
    let customChips;
    try {
      customChips =
        (typeof $customChips === 'function' && $customChips(config)) ||
        $customChips ||
        {};
      if (typeof build === 'function') {
        build.call(undefined, customChips);
      }
    } catch (buildError) {
      context.pop();
      throw buildError;
    }
    context.pop();
    // TODO validate chip:
    // - if input data but not flow it may not do what you expect
    // - if not using all input data in outputs/execs
    class Chip extends ChipBase {
      constructor(...canonicalValues) {
        super(chipInfo, canonicalValues);
        const parentChipInfo = context();
        // Add to current chip `build` execution
        if (parentChipInfo instanceof ChipInfo) {
          parentChipInfo.addChip(this);
        }
        // Run `constructed`
        else if (
          $hooks &&
          $hooks.onCreate &&
          typeof $hooks.onCreate.selectPorts === 'function'
        ) {
          runFlowPorts(this, $hooks.onCreate.selectPorts);
        }
      }

      destroy() {
        if (
          $hooks &&
          $hooks.onDestroy &&
          typeof $hooks.onDestroy.selectPorts === 'function'
        ) {
          runFlowPorts(this, $hooks.onDestroy.selectPorts);
        }
      }

      compile(wrapper) {
        const compilation = new Compilation(chipInfo, this);
        return compilation.compile(wrapper, $hooks);
      }

      //
      // Static public API
      //

      static get URI() {
        return chipInfo.URI;
      }

      static get imports() {
        return Object.assign(
          {},
          config.imports,
          ...chipInfo.chips.map((c) => c.constructor.imports),
        );
      }

      static compile(wrapper) {
        const compilation = new Compilation(chipInfo, null);
        return compilation.compile(wrapper, $hooks);
      }

      static async compiledClass(context, importModule) {
        const imports = Object.entries(this.imports);
        const importsNames = imports.map(([name]) => name);
        const importsValues = imports.map(([, url]) =>
          (importModule
            ? Promise.resolve(importModule(url))
            : import(url)
          ).then((m) => m.default || m),
        );
        const ctx = Object.entries(context || {}).filter(
          ([name]) => !importsNames.includes(name),
        );
        const ctxNames = ctx.map(([name]) => name);
        const ctxValues = ctx.map(([, val]) => val);
        const code = this.compile();
        const makeCompiledClass = new Function(
          ...importsNames,
          ...ctxNames,
          'return (' + code + ')',
        );
        return makeCompiledClass(
          ...(await Promise.all(importsValues)),
          ...(await Promise.all(ctxValues)),
        );
      }

      static toJSON() {
        const chipData = chipInfo.toJSON();
        if (!this.editable) {
          chipData.editable = false;
        }
        if (this.metadata) {
          // TODO clone-deep
          chipData.metadata = this.metadata;
        }
        return chipData;
      }

      static get metadata() {
        return config.metadata;
      }

      static set metadata(value) {
        config.metadata = value;
      }

      static get editable() {
        return config.editable;
      }

      static get isLoaded() {
        return chipInfo.isLoaded;
      }

      static get loaded() {
        return chipInfo.loaded;
      }

      static get inputOutlets() {
        return chipInfo.inputs.slice();
      }

      static get outputOutlets() {
        return chipInfo.outputs.slice();
      }

      static get chips() {
        return chipInfo.chips.slice();
      }

      static get customChipClasses() {
        return customChips;
      }

      static get connections() {
        return Array.from(chipInfo.sinkConnection.entries()).map(
          ([sinkPort, sourcePort]) => {
            let source = { chip: sourcePort.chip, port: sourcePort };
            let sink = { chip: sinkPort.chip, port: sinkPort };
            // If one of the ports is a flow outlet we need to invert the logic
            if (sinkPort.isFlow || (info(sinkPort) && info(sinkPort).isFlow)) {
              const tmp = source;
              source = sink;
              sink = tmp;
            }
            return {
              source,
              sink,
            };
          },
        );
      }
    }

    info(Chip, chipInfo);

    return Chip;
  }
  chip.extend = function extendChip(customChips, hooks) {
    return makeChipFactory(
      () =>
        Object.assign(
          {},
          (typeof $customChips === 'function' && $customChips()) ||
            $customChips,
          (typeof customChips === 'function' && customChips()) || customChips,
        ),
      Object.assign({}, $hooks, hooks),
    );
  };
  return chip;
}
