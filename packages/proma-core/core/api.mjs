import { context } from './utils.mjs';
import { Chip, ChipInfo } from './chip.mjs';

export class ChipMaker extends Function {}

export function chip(name, build) {
  if (typeof name !== 'string') {
    build = name;
    name = undefined;
  }
  const chipInfo = new ChipInfo(name);
  if (typeof build === 'function') {
    context.push(chipInfo);
    build.call();
    context.pop();
  }
  // TODO validate chip:
  // - if input data but not flow it may not do what you expect
  // - if not using all input data in outputs/execs
  function chipMaker(...configValues) {
    const chip = new Chip(chipInfo, configValues);
    // Add to current chip `build` execution
    const parentChipInfo = context();
    if (parentChipInfo instanceof ChipInfo) {
      parentChipInfo.addChip(chip);
    }
    return chip;
  }

  chipMaker.__proto__ = ChipMaker.prototype;

  return chipMaker;
}

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

export function inputConfig(name, defaultValue) {
  const chipInfo = context(ChipInfo);
  chipInfo.addInputDataPort(name, {
    canonical: true,
    conceiled: true,
    defaultValue,
  });
}
