import { info, assert, assertInfo } from './utils.mjs';
import { INPUT, OUTPUT } from './constants.mjs';

/**
 * @typedef {import('./chip.mjs').ChipInfo} ChipInfo
 * @typedef {import('./ports.mjs').Port} Port
 * @typedef {import('./ports.mjs').PortInfo} PortInfo
 * @typedef {unknown[]} CompilationScope
 */

/**
 * Recursively collects hook-eligible output flow ports from child chips.
 *
 * @param {unknown} chip
 * @param {(chip: unknown) => Port[] | undefined} selectPorts
 * @param {CompilationScope} [scope]
 * @returns {Array<{ port: Port, scope: CompilationScope }>}
 */
export function getHookPorts(chip, selectPorts, scope) {
  if (!scope) {
    scope = [chip];
  }
  /** @type {Array<{ port: Port, scope: CompilationScope }>} */
  const hookPorts = [];
  const chipInfo = info(chip);
  for (const subChip of chipInfo.chips) {
    const selectedPorts = selectPorts(subChip);
    if (!selectedPorts || selectedPorts.length === 0) {
      continue;
    }
    const newScope = [subChip, ...scope];
    for (const port of selectedPorts) {
      if (!port.isOutput || !port.isFlow) {
        throw new Error(
          `Can only select output flow ports as hooks. Got "${port.fullName}"`,
        );
      }
      hookPorts.push({
        port,
        scope: newScope,
      });
    }
  }
  for (const subChip of chipInfo.chips) {
    hookPorts.push(...getHookPorts(subChip, selectPorts, [subChip, ...scope]));
  }
  return hookPorts;
}

/**
 * @param {unknown} port
 * @param {CompilationScope} scope
 * @returns {boolean}
 */
export function isOutlet(port, scope) {
  const rootInfo = info(scope[scope.length - 1]);
  return rootInfo === info(port).chipInfo;
}

/**
 * @param {ChipInfo} chipInfo
 * @returns {unknown}
 */
export function makeChipInstanceMock(chipInfo) {
  /** @type {{ [name: string]: unknown }} */
  const input = chipInfo.inputs.reduce(
    /**
     * @param {{ [name: string]: unknown }} acc
     * @param {{ name: string }} outlet
     */
    (acc, outlet) => {
      acc[outlet.name] = outlet;
      return acc;
    },
    /** @type {{ [name: string]: unknown }} */ ({}),
  );
  /** @type {{ [name: string]: unknown }} */
  const output = chipInfo.outputs.reduce(
    /**
     * @param {{ [name: string]: unknown }} acc
     * @param {{ name: string }} outlet
     */
    (acc, outlet) => {
      acc[outlet.name] = outlet;
      return acc;
    },
    /** @type {{ [name: string]: unknown }} */ ({}),
  );

  return info(
    {
      isMock: true,
      [INPUT]: input,
      [OUTPUT]: output,
    },
    chipInfo,
  );
}

/**
 * When using `compile` from a custom compilation function, we allow users
 * to use the local outlet to refer to the chip instance port.
 *
 * @param {unknown} port
 * @param {CompilationScope} scope
 * @returns {{ port: unknown, chip: unknown, parentChip: unknown }}
 */
export function getPortAndChipInstance(port, scope) {
  const [chip, parentChip] = scope;
  if (port.isOutlet && !isOutlet(port, scope)) {
    port = chip[port.isInput ? INPUT : OUTPUT][port.name];
  }
  return { port, chip, parentChip };
}

/**
 * @param {unknown} port
 * @param {CompilationScope} scope
 * @returns {unknown[]}
 */
export function getConnectedPorts(port, scope) {
  const { port: resolvedPort, parentChip } = getPortAndChipInstance(
    port,
    scope,
  );
  return info(parentChip).getConnectedPorts(resolvedPort, parentChip);
}
