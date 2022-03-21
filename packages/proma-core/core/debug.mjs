import { Chip } from './chip.mjs';
import { info, assert } from './utils.mjs';
import { INPUT, OUTPUT } from './ports.mjs';

export function debug(instance) {
  assert(instance instanceof Chip, 'debug() requires a chip instance');
  return new ChipDebugger(instance);
}

class ChipDebugger {
  constructor(instance) {
    this.chip = instance;
  }

  get chipIds() {
    const chipInfo = info(this.chip);
    return chipInfo.chips.map((c) => c.id);
  }

  runValue(chipId, portSide, portName) {
    if (!portSide) {
      const parts = chipId.split('.');
      chipId = parts[0];
      portSide = parts[1];
      portName = parts[2];
    }
    // TODO validate args
    let c;
    if (chipId === this.chip.id || chipId === '$') {
      c = this.chip;
    } else {
      const chipInfo = info(this.chip);
      c = chipInfo.getChip(chipId);
    }
    return c[portSide][portName].$runValue;
  }
}
