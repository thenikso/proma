import { info } from './utils.mjs';
import { registry } from './registry.mjs';
import { isChipClass } from './chip.mjs';
import { PlaceholderChip } from './placeholder.mjs';

//
// Serialization
//

export function serializeChipInstance(chip) {
  const res = {
    id: chip.id,
    chipURI: chip.chipURI,
  };

  const chipInfo = info(chip);
  let canonicalData = [];
  const initData = {};
  for (const portInfo of chipInfo.inputDataPorts) {
    // const portInfo = info(portOutlet);
    const portValue = chip.in[portInfo.name].value;
    if (portInfo.canonical) {
      if (portInfo.isVariadic) {
        canonicalData.push(...portValue);
      } else {
        canonicalData.push(portValue);
      }
    } else if (typeof portValue !== 'undefined') {
      initData[portInfo.name] = portValue;
    }
  }
  // Add canonical init args
  for (let i = canonicalData.length - 1; i >= 0; i--) {
    if (typeof canonicalData[i] === 'undefined') {
      canonicalData.pop();
    }
  }
  if (canonicalData.length > 0) {
    res.args = canonicalData;
  }
  // Add input port init data
  if (Object.keys(initData).length > 0) {
    res.init = initData;
  }

  return res;
}

export function serializeChipInfo(chipInfo) {
  const toJSON = (x) => x.toJSON();
  const inputs = chipInfo.inputs.map(toJSON);
  const outputs = chipInfo.outputs.map(toJSON);
  const chips = chipInfo.chips.map(toJSON);
  const connections = Array.from(chipInfo.sinkConnection.entries()).map(
    ([sink, source]) => {
      // TODO reorder in case of outlets
      const sourceName = source.fullName || source.name;
      const sinkName = sink.fullName || sink.name;
      return {
        source: sourceName,
        sink: sinkName,
      };
    },
  );
  const res = {
    URI: chipInfo.URI,
  };
  if (inputs.length > 0) {
    res.inputs = inputs;
  }
  if (outputs.length > 0) {
    res.outputs = outputs;
  }
  if (chips.length > 0) {
    res.chips = chips;
  }
  if (connections.length > 0) {
    res.connections = connections;
  }
  return res;
}

export function serializePortInfo(portInfo) {
  const res = {
    name: portInfo.name,
    kind: portInfo.isFlow ? 'flow' : 'data',
  };
  // Input flow
  if (typeof portInfo.execute !== 'undefined') {
    res.execute = funcToString(portInfo.execute);
  }
  // Input data
  if (portInfo.canonical === true) {
    res.canonical = portInfo.canonical;
  }
  if (portInfo.conceiled === true) {
    res.conceiled = portInfo.conceiled;
  }
  if (portInfo.variadic) {
    res.variadic = portInfo.variadic;
  }
  if (typeof portInfo.defaultValue !== 'undefined') {
    res.defaultValue = portInfo.defaultValue;
  }
  // Output data
  if (typeof portInfo.compute !== 'undefined') {
    res.compute = funcToString(portInfo.compute);
  }
  if (Array.isArray(portInfo.computeOn) && portInfo.computeOn.length > 0) {
    res.computeOn = portInfo.computeOn.map((p) => p.name);
  }
  if (typeof portInfo.inline !== 'undefined') {
    res.inline = portInfo.inline;
  }
  if (portInfo.allowSideEffects) {
    res.allowSideEffects = portInfo.allowSideEffects;
  }
  return res;
}

function funcToString(func) {
  // TODO use recast to clean this
  return String(func);
}

//
// Deserialization
//

export function deserializeChip(chip, data) {
  // TODO validate `data`
  const res = chip(data.URI);
  const build = res.edit();
  const portsToCompile = [];
  for (const port of data.inputs || []) {
    if (port.kind === 'flow') {
      build.addInputFlowPort(port.name, {
        execute: port.execute && makePortFunction(port.execute),
      });
      if (port.execute) {
        portsToCompile.push(port);
      }
    } else {
      build.addInputDataPort(port.name, {
        canonical: port.canonical,
        conceiled: port.conceiled,
        defaultValue: port.defaultValue,
      });
    }
  }
  for (const port of data.outputs || []) {
    if (port.kind === 'flow') {
      build.addOutputFlowPort(port.name);
    } else {
      build.addOutputDataPort(port.name, {
        computeOn: (port.computeOn || []).map((portPath) =>
          build.getPort(portPath, 'out'),
        ),
        inline: port.inline,
        allowSideEffects: port.allowSideEffects,
      });
      if (port.compute) {
        portsToCompile.push(port);
      }
    }
  }
  for (const chipData of data.chips || []) {
    build.addChip(chipData.chipURI, chipData.args, chipData.id);
  }
  for (const conn of data.connections || []) {
    build.addConnection(conn.source, conn.sink);
  }
  for (const port of portsToCompile) {
    if (port.execute) {
      build.setPortExecute(port.name, port.execute);
    } else if (port.compute) {
      build.setPortCompute(port.name, port.compute);
    }
  }
  return build.Chip;
}

function makePortFunction(string) {
  const makeRes = new Function('return (' + string + ')');
  return makeRes();
}
