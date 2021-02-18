import { context, assert } from './utils.mjs';
import { Chip as ChipBase, ChipInfo } from './chip.mjs';
import { runIngresses } from './run.mjs';
import { EditableChipInfo } from './edit.mjs';
import { Compilation } from './compile.mjs';

export const OnCreateIngress = ingress('OnCreateIngress');

function makeChipFactory($buildIngresses, $constructed) {
  function chip(name, build) {
    if (typeof name !== 'string') {
      build = name;
      name = undefined;
    }
    const chipInfo = new ChipInfo(name);
    context.push(chipInfo);
    const ingresses =
      (typeof $buildIngresses === 'function' && $buildIngresses()) ||
      $buildIngresses ||
      {};
    if (typeof build === 'function') {
      build.call(undefined, ingresses);
    }
    context.pop();
    // TODO validate chip:
    // - if input data but not flow it may not do what you expect
    // - if not using all input data in outputs/execs
    class Chip extends ChipBase {
      constructor(...configValues) {
        super(chipInfo, configValues);
        const parentChipInfo = context();
        // Add to current chip `build` execution
        if (parentChipInfo instanceof ChipInfo) {
          parentChipInfo.addChip(this);
        }
        // Run `constructed`
        else if (typeof $constructed === 'function') {
          $constructed(this);
        }
      }

      // TODO accept an optional new "build" function that can have deleteChip..?
      static edit() {
        return new EditableChipInfo(this, chipInfo);
      }

      static compile(wrapper) {
        const compilation = new Compilation(chipInfo, null);
        return compilation.compile(wrapper);
      }

      compile(wrapper) {
        const compilation = new Compilation(chipInfo, this);
        return compilation.compile(wrapper);
      }
    }

    return Chip;
  }
  chip.extend = function extendChip(buildIngresses, constructed) {
    return makeChipFactory(
      () =>
        Object.assign(
          {},
          (typeof $buildIngresses === 'function' && $buildIngresses()) ||
            $buildIngresses,
          (typeof buildIngresses === 'function' && buildIngresses()) ||
            buildIngresses,
        ),
      (chip) => {
        if (typeof $constructed === 'function') $constructed(chip);
        if (typeof constructed === 'function') constructed(chip);
      },
    );
  };
  return chip;
}

export const chip = makeChipFactory(
  () => {
    const onCreate = new OnCreateIngress();
    return { onCreate };
  },
  (chip) => {
    runIngresses(chip, (i) => i instanceof OnCreateIngress);
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

export function outputFlow(name) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputFlowPort(name);
}

export function outputData(name, config) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addOutputDataPort(name, config);
}

export function wire(portA, portB) {
  const chipInfo = context(ChipInfo);
  chipInfo.addConnection(portA, portB);
}

export function inputConfig(name, defaultValue) {
  const chipInfo = context(ChipInfo);
  return chipInfo.addInputDataPort(name, {
    canonical: true,
    conceiled: true,
    defaultValue,
  });
}

export function outputHandle(name, execHandle) {
  assert(
    typeof execHandle === 'function',
    'A handler should specify a function',
  );
  const compute = () => execHandle;
  compute.toString = () => '() => ' + String(execHandle);
  return outputData(name, {
    compute,
    allowSideEffects: true,
  });
}

export function ingress(name, ...ports) {
  const ingressInfo = new ChipInfo(name);
  context.push(ingressInfo);
  // TODO funciton with ports and toString
  const handle = outputHandle('handle', () => then());
  const then = outputFlow('then');
  // TODO ports
  context.pop();

  class IngressChip extends ChipBase {
    constructor() {
      super(ingressInfo);
      // Add to current chip `build` execution
      const parentChipInfo = context();
      if (parentChipInfo instanceof ChipInfo) {
        parentChipInfo.ingresses.push(this);
      }
    }

    get isIngress() {
      return true;
    }
  }

  return IngressChip;
}
