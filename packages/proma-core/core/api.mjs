import { context, assert } from './utils.mjs';
import { Chip, ChipInfo } from './chip.mjs';
import { runIngresses } from './run.mjs';

export const OnCreateIngress = ingress('OnCreateIngress');

export function chip(name, build) {
  if (typeof name !== 'string') {
    build = name;
    name = undefined;
  }
  const chipInfo = new ChipInfo(name);
  if (typeof build === 'function') {
    context.push(chipInfo);
    const onCreate = new OnCreateIngress();
    build.call(undefined, { onCreate });
    context.pop();
  }
  // TODO validate chip:
  // - if input data but not flow it may not do what you expect
  // - if not using all input data in outputs/execs
  class ChipState extends Chip {
    constructor(...configValues) {
      super(chipInfo, configValues);
      const parentChipInfo = context();
      // Add to current chip `build` execution
      if (parentChipInfo instanceof ChipInfo) {
        parentChipInfo.addChip(this);
      }
      // Run `OnCreateIngress`es of this and all child chips
      else {
        runIngresses(this, (i) => i instanceof OnCreateIngress);
      }
    }
  }

  return ChipState;
}

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

  class IngressChip extends Chip {
    constructor() {
      super(ingressInfo);
      // Add to current chip `build` execution
      const parentChipInfo = context();
      if (parentChipInfo instanceof ChipInfo) {
        parentChipInfo.ingresses.push(this);
      }
    }
  }

  return IngressChip;
}
