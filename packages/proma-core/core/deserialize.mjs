// @ts-check
import { INPUT, OUTPUT } from './constants.mjs';
import { edit } from './edit.mjs';

/**
 * Serialized input flow outlet descriptor.
 *
 * @typedef {{
 *   name: string,
 *   kind: 'flow',
 *   execute?: string
 * }} SerializedInputFlowPort
 */

/**
 * Serialized input data outlet descriptor.
 *
 * @typedef {{
 *   name: string,
 *   kind: 'data',
 *   canonical?: boolean,
 *   concealed?: boolean | 'hidden',
 *   defaultValue?: unknown,
 *   type?: string
 * }} SerializedInputDataPort
 */

/**
 * Serialized output flow outlet descriptor.
 *
 * @typedef {{
 *   name: string,
 *   kind: 'flow'
 * }} SerializedOutputFlowPort
 */

/**
 * Serialized output data outlet descriptor.
 *
 * @typedef {{
 *   name: string,
 *   kind: 'data',
 *   compute?: string,
 *   computeOn?: string[],
 *   inline?: boolean | 'once',
 *   allowSideEffects?: boolean,
 *   type?: string
 * }} SerializedOutputDataPort
 */

/**
 * @typedef {SerializedInputFlowPort | SerializedInputDataPort} SerializedInputPort
 * @typedef {SerializedOutputFlowPort | SerializedOutputDataPort} SerializedOutputPort
 */

/**
 * Port descriptors that store executable code snippets to apply after outlets
 * are created.
 *
 * @typedef {{
 *   name: string,
 *   execute?: string,
 *   compute?: string
 * }} SerializedCompilablePort
 */

/**
 * Serialized child chip instance descriptor.
 *
 * @typedef {{
 *   chipURI: string,
 *   args?: unknown[],
 *   id?: string,
 *   label?: string
 * }} SerializedChipInstance
 */

/**
 * Typed adapter for the subset of edit API used during deserialization.
 *
 * @typedef {{
 *   Chip: typeof import('./chip.mjs').Chip,
 *   addUse: (useURI: string) => Promise<unknown>,
 *   addInputFlowOutlet: (name: string) => unknown,
 *   addInputDataOutlet: (name: string, config?: { canonical?: boolean, concealed?: boolean | 'hidden', defaultValue?: unknown, type?: string }) => unknown,
 *   addOutputFlowOutlet: (name: string) => unknown,
 *   addOutputDataOutlet: (name: string, config?: { computeOn?: unknown[], inline?: boolean | 'once', allowSideEffects?: boolean, type?: string }) => unknown,
 *   getPort: (portPath: string, side?: 'in' | 'out') => unknown,
 *   addChip: (chipURI: string, args?: unknown[], id?: string) => unknown,
 *   setChipLabel: (chipId: string | undefined, label: string) => unknown,
 *   addConnection: (sourcePortPath: string, sinkPortPath: string) => unknown,
 *   setPortExecute: (portPath: string, execute: string) => unknown,
 *   setPortCompute: (portPath: string, compute: string) => unknown
 * }} DeserializerBuild
 */

/**
 * @typedef {{
 *   URI: string,
 *   metadata?: unknown,
 *   use?: string[],
 *   chips?: SerializedChipInstance[],
 *   connections?: Array<{ source: string, sink: string }>,
 *   [INPUT]?: SerializedInputPort[],
 *   [OUTPUT]?: SerializedOutputPort[]
 * }} SerializedChip
 */

/**
 * Build a chip class from serialized data.
 *
 * @param {(URI: string, build?: null, options?: { editable?: boolean }) => unknown} chip
 * @param {SerializedChip | string} data
 * @param {{ registry?: import('./registry.mjs').Registry, withErrors?: (errors: unknown[]) => void }} [options]
 * @returns {Promise<typeof import('./chip.mjs').Chip>}
 */
export async function fromJSON(chip, data, { registry, withErrors } = {}) {
  /** @type {SerializedChip} */
  const chipData = typeof data === 'string' ? JSON.parse(data) : data;
  const ChipClass = await deserializeChip(chip, chipData, registry, withErrors);
  /** @type {{ metadata?: unknown }} */ (ChipClass).metadata =
    chipData.metadata;
  return ChipClass;
}

//
// Deserialization
//

/**
 * Deserialize serialized chip metadata into an editable chip class.
 *
 * @param {(URI: string, build?: null, options?: { editable?: boolean }) => unknown} chip
 * @param {SerializedChip} data
 * @param {import('./registry.mjs').Registry | undefined} registry
 * @param {((errors: unknown[]) => void) | undefined} withErrors
 * @returns {Promise<typeof import('./chip.mjs').Chip>}
 */
async function deserializeChip(chip, data, registry, withErrors) {
  // TODO validate `data`
  const res = chip(data.URI, null, { editable: true });
  /** @type {DeserializerBuild} */
  const build = /** @type {DeserializerBuild} */ (edit(res, registry));
  const useSet = new Set(data.use);
  useSet.add('proma/std');
  await Promise.all([...useSet].map((u) => build.addUse(u)));
  /** @type {unknown[]} */
  const errors = [];
  /** @type {SerializedCompilablePort[]} */
  const portsToCompile = [];
  const inputPorts = /** @type {SerializedInputPort[]} */ (data[INPUT] || []);
  for (const port of inputPorts) {
    try {
      if (port.kind === 'flow') {
        build.addInputFlowOutlet(port.name);
        if (port.execute) {
          portsToCompile.push(port);
        }
      } else {
        build.addInputDataOutlet(port.name, {
          canonical: port.canonical,
          concealed: port.concealed,
          defaultValue: port.defaultValue,
          type: port.type || 'any',
        });
      }
    } catch (e) {
      errors.push(e);
    }
  }
  const outputPorts = /** @type {SerializedOutputPort[]} */ (
    data[OUTPUT] || []
  );
  for (const port of outputPorts) {
    try {
      if (port.kind === 'flow') {
        build.addOutputFlowOutlet(port.name);
      } else {
        build.addOutputDataOutlet(port.name, {
          computeOn: (port.computeOn || []).map(
            (/** @type {string} */ portPath) => build.getPort(portPath, 'out'),
          ),
          inline: port.inline,
          allowSideEffects: port.allowSideEffects,
          type: port.type || 'any',
        });
        if (port.compute) {
          portsToCompile.push(port);
        }
      }
    } catch (e) {
      errors.push(e);
    }
  }
  for (const chipData of data.chips || []) {
    build.addChip(chipData.chipURI, chipData.args, chipData.id);
    if (chipData.label) {
      build.setChipLabel(chipData.id, chipData.label);
    }
  }
  for (const conn of data.connections || []) {
    try {
      build.addConnection(conn.source, conn.sink);
    } catch (e) {
      errors.push(e);
    }
  }
  for (const port of portsToCompile) {
    try {
      if (port.execute) {
        build.setPortExecute(port.name, port.execute);
      } else if (port.compute) {
        build.setPortCompute(port.name, port.compute);
      }
    } catch (e) {
      errors.push(e);
    }
  }
  if (errors.length > 0 && typeof withErrors === 'function') {
    withErrors(errors);
  }
  return build.Chip;
}
