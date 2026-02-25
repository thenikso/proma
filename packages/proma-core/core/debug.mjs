// @ts-check
import { Chip } from './chip.mjs';
import { info, assert } from './utils.mjs';
import { INPUT, OUTPUT } from './constants.mjs';

/**
 * @typedef {{ name: string, side: 'in' | 'out', kind: 'flow' | 'data', value: any, type?: string }} PortDebugDescriptor
 * @typedef {{ [path: string]: any }} PortValueMap
 */

/**
 * @param {Chip} instance
 * @returns {ChipDebugger}
 */
export function debug(instance) {
  assert(instance instanceof Chip, 'debug() requires a chip instance');
  return new ChipDebugger(instance);
}

class ChipDebugger {
  /** @param {Chip} instance */
  constructor(instance) {
    this.chip = instance;
  }

  get chipIds() {
    const chipInfo = info(this.chip);
    return chipInfo.chips.map((c) => c.id);
  }

  /**
   * @param {string} chipId
   * @param {string} [portSide]
   * @param {string} [portName]
   * @returns {any}
   */
  runValue(chipId, portSide, portName) {
    if (!portSide) {
      const parts = chipId.split('.');
      chipId = parts[0];
      portSide = parts[1];
      portName = parts[2];
    }
    // TODO validate args
    let c;
    if (chipId === /** @type {any} */ (this.chip).id || chipId === '$') {
      c = this.chip;
    } else {
      const chipInfo = info(this.chip);
      c = chipInfo.getChip(chipId);
    }
    return c[portSide][portName].$runValue;
  }

  // Returns a snapshot of all data port $runValues for all chips.
  // The result is an object keyed by chip id (root chip uses '$'),
  // where each value is an object of 'in.portName' / 'out.portName' -> value.
  /**
   * @returns {Record<string, PortValueMap>}
   */
  snapshot() {
    const chipInfo = info(this.chip);
    /** @type {Record<string, PortValueMap>} */
    const result = {};
    result['$'] = chipPortValues(this.chip);
    for (const subChip of chipInfo.chips) {
      result[subChip.id] = chipPortValues(subChip);
    }
    return result;
  }

  // Returns an array of port descriptors for the given chip (by id).
  // Use '$' or omit chipId to inspect the root chip.
  // Each descriptor has: { name, side, kind, value, type }
  /**
   * @param {string} [chipId]
   * @returns {PortDebugDescriptor[] | null}
   */
  ports(chipId) {
    let chipInstance;
    if (!chipId || chipId === '$') {
      chipInstance = this.chip;
    } else {
      const chipInfo = info(this.chip);
      chipInstance = chipInfo.getChip(chipId);
    }
    if (!chipInstance) return null;

    const chipInfo = info(chipInstance);
    /** @type {PortDebugDescriptor[]} */
    const result = [];

    for (const outlet of chipInfo.inputs) {
      const portInfo = info(outlet);
      const port = chipInstance[INPUT][outlet.name];
      result.push({
        name: outlet.name,
        side: 'in',
        kind: portInfo.isFlow ? 'flow' : 'data',
        value: port ? port.$runValue : undefined,
        type: port && port.type ? port.type.signature : undefined,
      });
    }

    for (const outlet of chipInfo.outputs) {
      const portInfo = info(outlet);
      const port = chipInstance[OUTPUT][outlet.name];
      result.push({
        name: outlet.name,
        side: 'out',
        kind: portInfo.isFlow ? 'flow' : 'data',
        value: port ? port.$runValue : undefined,
        type: port && port.type ? port.type.signature : undefined,
      });
    }

    return result;
  }

  // Captures the current values of the given port paths before execution,
  // then provides a capture() method to record the after values.
  // portPaths use the same dot-separated format as runValue: 'ChipId.in.portName'
  /**
   * @param {string[]} portPaths
   * @returns {{ before: PortValueMap, capture: () => { before: PortValueMap, after: PortValueMap } }}
   */
  watch(portPaths) {
    /** @type {PortValueMap} */
    const before = {};
    for (const path of portPaths) {
      before[path] = this.runValue(path);
    }

    return {
      before,
      capture: () => {
        /** @type {PortValueMap} */
        const after = {};
        for (const path of portPaths) {
          after[path] = this.runValue(path);
        }
        return { before: { ...before }, after };
      },
    };
  }
}

/**
 * @param {Chip} chipInstance
 * @returns {PortValueMap}
 */
function chipPortValues(chipInstance) {
  const chipInfo = info(chipInstance);
  /** @type {PortValueMap} */
  const values = {};
  for (const outlet of chipInfo.inputs) {
    const portInfo = info(outlet);
    if (!portInfo.isData) continue;
    const port = chipInstance[INPUT][outlet.name];
    if (port) values[`in.${outlet.name}`] = port.$runValue;
  }
  for (const outlet of chipInfo.outputs) {
    const portInfo = info(outlet);
    if (!portInfo.isData) continue;
    const port = chipInstance[OUTPUT][outlet.name];
    if (port) values[`out.${outlet.name}`] = port.$runValue;
  }
  return values;
}
