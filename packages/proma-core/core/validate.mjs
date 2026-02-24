import { info } from './utils.mjs';
import { Chip, ChipInfo } from './chip.mjs';
import { Port, PortInfo } from './ports.mjs';

/**
 * Validates a chip definition and returns an array of diagnostic messages.
 * @param {Function|object} chipClassOrInstance - A chip class, chip instance, or ChipInfo to validate
 * @returns {Array<{level: string, code: string, message: string, path: string}>}
 */
export function validate(chipClassOrInstance) {
  let chipInfo;
  if (chipClassOrInstance instanceof ChipInfo) {
    chipInfo = chipClassOrInstance;
  } else if (chipClassOrInstance instanceof Chip) {
    chipInfo = info(chipClassOrInstance.constructor);
  } else if (typeof chipClassOrInstance === 'function') {
    chipInfo = info(chipClassOrInstance);
  } else {
    chipInfo = null;
  }

  if (!chipInfo) {
    return [{ level: 'error', code: 'invalid-chip', message: 'Invalid chip', path: '' }];
  }

  const diagnostics = [];

  checkDisconnectedInputs(chipInfo, diagnostics);
  checkUnreachableChips(chipInfo, diagnostics);
  checkDanglingFlowOutputs(chipInfo, diagnostics);
  checkMissingFlowEntry(chipInfo, diagnostics);
  checkDataCycles(chipInfo, diagnostics);

  return diagnostics;
}

/**
 * Check for sub-chip input data ports that have no connection, no explicit value,
 * and no default value. Concealed ports are skipped since they are user-settable and
 * must have a default value.
 */
function checkDisconnectedInputs(chipInfo, diagnostics) {
  // Collect all ports that appear as sinks in sinkConnection
  const connectedSinks = new Set(chipInfo.sinkConnection.keys());

  for (const subChip of chipInfo.chips) {
    const subChipInfo = info(subChip);
    if (!subChipInfo) continue;

    for (const portOutlet of subChipInfo.inputs) {
      const portInfo = info(portOutlet);
      if (!portInfo.isData) continue;

      // Get the actual Port instance on this sub-chip instance
      const port = subChip.in[portOutlet.name];
      if (!port) continue;

      // Skip concealed ports — they are user-settable and should have defaults
      if (port.isConcealed) continue;

      // Check if connected
      const isConnected = connectedSinks.has(port);
      // Check if has explicit value
      const hasExplicitValue = typeof port.explicitValue !== 'undefined';
      // Check if has default value
      const hasDefaultValue = typeof port.defaultValue !== 'undefined';

      if (!isConnected && !hasExplicitValue && !hasDefaultValue) {
        diagnostics.push({
          level: 'warning',
          code: 'disconnected-input',
          message: `Input data port "${port.fullName}" has no connection or value`,
          path: port.fullName,
        });
      }
    }
  }
}

/**
 * Check for sub-chips that have no ports appearing in any connection.
 */
function checkUnreachableChips(chipInfo, diagnostics) {
  // Collect all chips referenced in any connection
  const connectedChips = new Set();

  for (const [sink, source] of chipInfo.sinkConnection.entries()) {
    if (sink instanceof Port && sink.chip) {
      connectedChips.add(sink.chip);
    }
    if (source instanceof Port && source.chip) {
      connectedChips.add(source.chip);
    }
  }
  for (const [source, sinks] of chipInfo.sourceConnections.entries()) {
    if (source instanceof Port && source.chip) {
      connectedChips.add(source.chip);
    }
    for (const sink of sinks) {
      if (sink instanceof Port && sink.chip) {
        connectedChips.add(sink.chip);
      }
    }
  }

  for (const subChip of chipInfo.chips) {
    if (!connectedChips.has(subChip)) {
      diagnostics.push({
        level: 'warning',
        code: 'unreachable-chip',
        message: `Sub-chip "${subChip.id}" has no connections`,
        path: subChip.id,
      });
    }
  }
}

/**
 * For non-flowless chips, check that output flow ports of sub-chips are connected.
 * A dangling output flow port means execution would stop unexpectedly.
 *
 * Sub-chip output flow ports are sinks in the connection map (appear as keys in
 * sinkConnection). A "dangling" flow port is one that does not appear as a key.
 */
function checkDanglingFlowOutputs(chipInfo, diagnostics) {
  if (chipInfo.isFlowless) return;

  // Collect all output flow sink ports (sub-chip out flow) that ARE connected
  // These appear as keys in sinkConnection
  const connectedOutputFlowSinks = new Set(chipInfo.sinkConnection.keys());

  for (const subChip of chipInfo.chips) {
    const subChipInfo = info(subChip);
    if (!subChipInfo) continue;
    if (subChipInfo.isFlowless) continue;

    for (const portOutlet of subChipInfo.outputs) {
      const portInfo = info(portOutlet);
      if (!portInfo.isFlow) continue;

      const port = subChip.out[portOutlet.name];
      if (!port) continue;

      if (!connectedOutputFlowSinks.has(port)) {
        diagnostics.push({
          level: 'warning',
          code: 'dangling-flow',
          message: `Output flow port "${port.fullName}" is not connected`,
          path: port.fullName,
        });
      }
    }
  }
}

/**
 * For a chip with input flow outlets, check that at least one is connected to a
 * sub-chip. Without this, execution cannot enter the chip body.
 *
 * Input flow outlets are PortInfo keys in sinkConnection when they connect to
 * sub-chip input flow ports. If none of them appear in sinkConnection, the chip
 * has no execution entry point.
 */
function checkMissingFlowEntry(chipInfo, diagnostics) {
  if (chipInfo.isFlowless) return;

  const inputFlowOutlets = chipInfo.inputFlowPorts;
  if (inputFlowOutlets.length === 0) return;

  // Check if any input flow outlet is connected
  // Input flow outlets as PortInfo objects appear as keys in sinkConnection
  const connectedSinks = new Set(chipInfo.sinkConnection.keys());

  let anyConnected = false;
  for (const outlet of inputFlowOutlets) {
    const outletInfo = info(outlet);
    if (connectedSinks.has(outletInfo)) {
      anyConnected = true;
      break;
    }
  }

  if (!anyConnected) {
    diagnostics.push({
      level: 'warning',
      code: 'no-entry-flow',
      message: 'No input flow outlet is connected to any sub-chip',
      path: '',
    });
  }
}

/**
 * Detect cycles in data connections using DFS.
 * Data flows: output data ports (sources) → input data ports (sinks).
 * A cycle would mean a port's value depends on itself.
 *
 * In the connection map:
 * - sourceConnections keys include sub-chip output data Ports (isSource=true)
 * - sinkConnection keys include sub-chip input data Ports (isSink=true)
 *
 * We build a graph: for each source port, find its sinks, then for each sink
 * (input data of a sub-chip), find if the chip's output data ports are sources.
 * If following the chain returns to a port we've already visited, it's a cycle.
 */
function checkDataCycles(chipInfo, diagnostics) {
  // Build adjacency: source Port → [sink Port]
  // Only for data ports (output data source → input data sink)
  const dataAdj = new Map();

  for (const [source, sinks] of chipInfo.sourceConnections.entries()) {
    // Only care about Port instances (not PortInfo outlets) with isData
    if (!(source instanceof Port) || !source.isData) continue;
    const dataSinks = sinks.filter((s) => s instanceof Port && s.isData);
    if (dataSinks.length > 0) {
      dataAdj.set(source, dataSinks);
    }
  }

  // For each sink (input data port of a sub-chip), find the sub-chip's output
  // data sources. This creates chip-level dependencies.
  // We want: subChip.in.x → subChip.out.y (via computation within the chip)
  // Then subChip.out.y may feed into another chip's input.
  // For cycle detection we trace: outDataPort → [inDataPorts it connects to]
  // then for each such inDataPort's chip, its outDataPorts continue the chain.

  const visited = new Set();
  const inStack = new Set();

  function dfs(port) {
    if (inStack.has(port)) {
      return true; // cycle detected
    }
    if (visited.has(port)) {
      return false; // already processed, no cycle from here
    }
    visited.add(port);
    inStack.add(port);

    const sinks = dataAdj.get(port) || [];
    for (const sink of sinks) {
      // sink is an input data port of some sub-chip
      // From that sub-chip, output data ports depend on input data
      const sinkChip = sink.chip;
      const sinkChipInfo = info(sinkChip);
      if (sinkChipInfo) {
        // All output data ports of this chip could be downstream
        for (const outputPortlet of sinkChipInfo.outputs) {
          const outPortInfo = info(outputPortlet);
          if (!outPortInfo.isData) continue;
          const outPort = sinkChip.out[outputPortlet.name];
          if (outPort && dfs(outPort)) {
            return true;
          }
        }
      }
    }

    inStack.delete(port);
    return false;
  }

  for (const source of dataAdj.keys()) {
    if (!visited.has(source) && dfs(source)) {
      diagnostics.push({
        level: 'error',
        code: 'data-cycle',
        message: `Data cycle detected involving port "${source.fullName}"`,
        path: source.fullName,
      });
    }
  }
}
